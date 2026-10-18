import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal } from '../../components/ui/Modal.tsx'
import { useToast } from '../../hooks/useToast.ts'
import type { Schedule } from '../../types/database.ts'
import {
  defaultScheduleRange,
  gridRange,
  scheduleOverlapsDay,
  startOfDay,
  startOfMonth,
} from './dateTime.ts'
import { ScheduleCalendar } from './ScheduleCalendar.tsx'
import { ScheduleForm } from './ScheduleForm.tsx'
import { ScheduleList } from './ScheduleList.tsx'
import { createSchedule, deleteSchedule, fetchSchedules, updateSchedule } from './scheduleApi.ts'
import { scheduleToFormValues, type ScheduleFormValues } from './scheduleSchema.ts'

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; schedule: Schedule }
  | null

type ScheduleSectionProps = {
  userId: string
}

export function ScheduleSection({ userId }: ScheduleSectionProps) {
  const queryClient = useQueryClient()
  const { push } = useToast()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [editor, setEditor] = useState<EditorState>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const range = gridRange(month)
  const schedulesQuery = useQuery({
    queryKey: ['schedules', userId, range.start.toISOString(), range.end.toISOString()],
    queryFn: () => fetchSchedules(userId, range.start, range.end),
  })
  const schedules = schedulesQuery.data ?? []
  const daySchedules = schedules.filter((item) => scheduleOverlapsDay(item, selectedDate))
  const saveMutation = useMutation({
    mutationFn: (values: ScheduleFormValues) => {
      if (editor?.mode === 'edit') {
        return updateSchedule(editor.schedule.id, userId, values)
      }

      return createSchedule(userId, values)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedules', userId] })
      push({
        tone: 'success',
        message: editor?.mode === 'edit' ? '일정을 수정했습니다.' : '일정을 추가했습니다.',
      })
      setEditor(null)
    },
    onError: (error) => {
      push({
        tone: 'error',
        message: error instanceof Error ? error.message : '일정을 저장하지 못했습니다.',
      })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (schedule: Schedule) => deleteSchedule(schedule.id, userId),
    onMutate: (schedule) => {
      setDeletingId(schedule.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedules', userId] })
      push({ tone: 'success', message: '일정을 삭제했습니다.' })
    },
    onError: (error) => {
      push({
        tone: 'error',
        message: error instanceof Error ? error.message : '일정을 삭제하지 못했습니다.',
      })
    },
    onSettled: () => {
      setDeletingId(null)
    },
  })
  const formDefaults: ScheduleFormValues =
    editor?.mode === 'edit'
      ? scheduleToFormValues(editor.schedule)
      : {
          title: '',
          ...defaultScheduleRange(selectedDate),
          location: '',
          memo: '',
        }

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
      <ScheduleCalendar
        month={month}
        selectedDate={selectedDate}
        schedules={schedules}
        onMonthChange={(next) => {
          const nextMonth = startOfMonth(next)
          setMonth(nextMonth)
          setSelectedDate(nextMonth)
        }}
        onSelectDate={(date) => {
          const day = startOfDay(date)
          setSelectedDate(day)
          setMonth(startOfMonth(day))
        }}
      />
      <ScheduleList
        date={selectedDate}
        schedules={daySchedules}
        status={schedulesQuery.isPending ? 'loading' : schedulesQuery.isError ? 'error' : 'ready'}
        errorMessage={
          schedulesQuery.error instanceof Error ? schedulesQuery.error.message : undefined
        }
        deletingId={deletingId}
        onRetry={() => {
          void schedulesQuery.refetch()
        }}
        onCreate={() => setEditor({ mode: 'create' })}
        onEdit={(schedule) => setEditor({ mode: 'edit', schedule })}
        onDelete={(schedule) => {
          deleteMutation.mutate(schedule)
        }}
      />
      <Modal
        open={editor !== null}
        title={editor?.mode === 'edit' ? '일정 수정' : '일정 추가'}
        onClose={() => {
          if (!saveMutation.isPending) {
            setEditor(null)
          }
        }}
      >
        {editor ? (
          <ScheduleForm
            key={editor.mode === 'edit' ? editor.schedule.id : selectedDate.toISOString()}
            defaultValues={formDefaults}
            submitting={saveMutation.isPending}
            onSubmit={(value) => {
              saveMutation.mutate(value)
            }}
          />
        ) : null}
      </Modal>
    </div>
  )
}