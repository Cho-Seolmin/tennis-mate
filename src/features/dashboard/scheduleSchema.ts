import { z } from 'zod'
import { isValidLocalDateTime, localDateTimeToIso, parseLocalDateTime, toLocalInputValue } from './dateTime.ts'

const localDateTime = z
  .string()
  .trim()
  .min(1, { error: '날짜와 시간을 입력해 주세요.' })
  .refine(isValidLocalDateTime, { error: '올바른 날짜와 시간을 입력해 주세요.' })

export const scheduleFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { error: '제목을 입력해 주세요.' })
      .max(100, { error: '제목은 100자까지 입력할 수 있습니다.' }),
    start_at: localDateTime,
    end_at: localDateTime,
    location: z
      .string()
      .trim()
      .max(200, { error: '장소는 200자까지 입력할 수 있습니다.' })
      .optional(),
    memo: z
      .string()
      .trim()
      .max(500, { error: '메모는 500자까지 입력할 수 있습니다.' })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (!isValidLocalDateTime(value.start_at) || !isValidLocalDateTime(value.end_at)) {
      return
    }

    const start = parseLocalDateTime(value.start_at)
    const end = parseLocalDateTime(value.end_at)

    if (!start || !end || end.getTime() <= start.getTime()) {
      ctx.addIssue({
        code: 'custom',
        path: ['end_at'],
        message: '종료 시간은 시작 시간보다 늦어야 합니다.',
      })
    }
  })

export const scheduleWriteSchema = scheduleFormSchema.transform((value) => ({
  title: value.title,
  start_at: localDateTimeToIso(value.start_at),
  end_at: localDateTimeToIso(value.end_at),
  location: value.location ? value.location : null,
  memo: value.memo ? value.memo : null,
}))

export type ScheduleFormValues = z.input<typeof scheduleWriteSchema>
export type ScheduleWriteDto = z.output<typeof scheduleWriteSchema>

export function scheduleToFormValues(schedule: {
  title: string
  start_at: string
  end_at: string
  location: string | null
  memo: string | null
}): ScheduleFormValues {
  return {
    title: schedule.title,
    start_at: toLocalInputValue(new Date(schedule.start_at)),
    end_at: toLocalInputValue(new Date(schedule.end_at)),
    location: schedule.location ?? '',
    memo: schedule.memo ?? '',
  }
}
