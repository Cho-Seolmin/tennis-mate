import { useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import type { Schedule } from '../../types/database.ts'
import { formatFullDate, formatScheduleRange } from './dateTime.ts'

type ScheduleListProps = {
  date: Date
  schedules: Schedule[]
  status: 'loading' | 'error' | 'ready'
  errorMessage?: string
  deletingId: string | null
  onRetry: () => void
  onCreate: () => void
  onEdit: (schedule: Schedule) => void
  onDelete: (schedule: Schedule) => void
}

export function ScheduleList({
  date,
  schedules,
  status,
  errorMessage,
  deletingId,
  onRetry,
  onCreate,
  onEdit,
  onDelete,
}: ScheduleListProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 text-lg font-semibold text-ink">{formatFullDate(date)} 일정</h2>
        <Button onClick={onCreate}>일정 추가</Button>
      </div>
      <div className="mt-4">
        {status === 'loading' ? <Loading label="일정을 불러오는 중" /> : null}
        {status === 'error' ? (
          <ErrorMessage
            title="일정을 불러오지 못했습니다"
            message={errorMessage ?? '다시 시도해 주세요.'}
            onRetry={onRetry}
          />
        ) : null}
        {status === 'ready' && schedules.length === 0 ? (
          <EmptyState
            title="이 날짜에 일정이 없습니다"
            description="선택한 날짜에 연습이나 경기를 추가해 보세요."
          />
        ) : null}
        {status === 'ready' && schedules.length > 0 ? (
          <ul className="space-y-3">
            {schedules.map((schedule) => (
              <li key={schedule.id} className="rounded-xl border border-line p-3">
                <h3 className="break-words text-base font-semibold text-ink">{schedule.title}</h3>
                <p className="mt-1 text-sm text-ink/70">
                  {formatScheduleRange(schedule.start_at, schedule.end_at)}
                </p>
                {schedule.location ? (
                  <p className="mt-1 break-words text-sm text-ink/80">{schedule.location}</p>
                ) : null}
                {schedule.memo ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink/75">
                    {schedule.memo}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    aria-label={`${schedule.title} 수정`}
                    onClick={() => onEdit(schedule)}
                  >
                    수정
                  </Button>
                  {pendingDeleteId === schedule.id ? (
                    <>
                      <Button variant="ghost" onClick={() => setPendingDeleteId(null)}>
                        취소
                      </Button>
                      <Button
                        aria-label={`${schedule.title} 삭제 확인`}
                        disabled={deletingId === schedule.id}
                        onClick={() => onDelete(schedule)}
                      >
                        {deletingId === schedule.id ? '삭제하는 중' : '삭제 확인'}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      aria-label={`${schedule.title} 삭제`}
                      onClick={() => setPendingDeleteId(schedule.id)}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  )
}
