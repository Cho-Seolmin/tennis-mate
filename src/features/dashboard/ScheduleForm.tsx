import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type FieldPath } from 'react-hook-form'
import { Button } from '../../components/ui/Button.tsx'
import { Input } from '../../components/ui/Input.tsx'
import { Textarea } from '../../components/ui/Textarea.tsx'
import {
  scheduleFormSchema,
  scheduleWriteSchema,
  type ScheduleFormValues,
} from './scheduleSchema.ts'

const scheduleFields = ['title', 'start_at', 'end_at', 'location', 'memo'] as const

type ScheduleFormProps = {
  defaultValues: ScheduleFormValues
  submitting: boolean
  onSubmit: (value: ScheduleFormValues) => void
}

export function ScheduleForm({ defaultValues, submitting, onSubmit }: ScheduleFormProps) {
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues,
  })

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        const parsed = scheduleWriteSchema.safeParse(values)

        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            const field = issue.path[0]

            if (isScheduleField(field)) {
              form.setError(field, { message: issue.message })
            }
          }
          return
        }

        onSubmit(values)
      })}
    >
      <Input
        label="제목"
        maxLength={100}
        error={form.formState.errors.title?.message}
        {...form.register('title')}
      />
      <Input
        label="시작"
        type="datetime-local"
        step={60}
        hint="이 기기의 시간대 기준입니다."
        error={form.formState.errors.start_at?.message}
        {...form.register('start_at')}
      />
      <Input
        label="종료"
        type="datetime-local"
        step={60}
        error={form.formState.errors.end_at?.message}
        {...form.register('end_at')}
      />
      <Input
        label="장소"
        maxLength={200}
        error={form.formState.errors.location?.message}
        {...form.register('location')}
      />
      <Textarea
        label="메모"
        maxLength={500}
        rows={4}
        error={form.formState.errors.memo?.message}
        {...form.register('memo')}
      />
      <Button type="submit" disabled={submitting}>
        {submitting ? '저장하는 중' : '일정 저장'}
      </Button>
    </form>
  )
}

function isScheduleField(value: PropertyKey | undefined): value is FieldPath<ScheduleFormValues> {
  return scheduleFields.some((field) => field === value)
}
