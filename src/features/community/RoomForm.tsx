import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '../../components/ui/Button.tsx'
import { Input } from '../../components/ui/Input.tsx'
import { roomFormSchema, roomWriteSchema, type RoomFormValues } from './roomSchema.ts'

type RoomFormProps = {
  defaultValues: RoomFormValues
  submitting: boolean
  onSubmit: (values: RoomFormValues) => void
}

export function RoomForm({ defaultValues, submitting, onSubmit }: RoomFormProps) {
  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomFormSchema),
    defaultValues,
  })

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        const parsed = roomWriteSchema.safeParse(values)

        if (!parsed.success) {
          const issue = parsed.error.issues[0]

          if (issue) {
            form.setError('root', { message: issue.message })
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
        label="장소"
        maxLength={200}
        error={form.formState.errors.location?.message}
        {...form.register('location')}
      />
      <Input
        label="날짜와 시간"
        type="datetime-local"
        step={60}
        hint="이 기기의 시간대 기준입니다."
        error={form.formState.errors.scheduled_at?.message}
        {...form.register('scheduled_at')}
      />
      <Input
        label="최대 인원"
        type="number"
        min={2}
        max={10}
        step={1}
        inputMode="numeric"
        hint="2명에서 10명까지"
        error={form.formState.errors.max_participants?.message}
        {...form.register('max_participants', { valueAsNumber: true })}
      />
      {form.formState.errors.root?.message ? (
        <p role="alert" className="text-sm text-danger">
          {form.formState.errors.root.message}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? '모임을 만드는 중' : '모임 만들기'}
      </Button>
    </form>
  )
}
