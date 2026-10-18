import { z } from 'zod'
import { isValidLocalDateTime, localDateTimeToIso, toLocalInputValue } from '../dashboard/dateTime.ts'

const localDateTime = z
  .string()
  .trim()
  .min(1, { error: '날짜와 시간을 입력해 주세요.' })
  .refine(isValidLocalDateTime, { error: '올바른 날짜와 시간을 입력해 주세요.' })

export const roomFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: '제목을 입력해 주세요.' })
    .max(100, { error: '제목은 100자까지 입력할 수 있습니다.' }),
  location: z
    .string()
    .trim()
    .min(1, { error: '장소를 입력해 주세요.' })
    .max(200, { error: '장소는 200자까지 입력할 수 있습니다.' }),
  scheduled_at: localDateTime,
  max_participants: z
    .number({ error: '정원을 입력해 주세요.' })
    .int({ error: '정원은 정수로 입력해 주세요.' })
    .min(2, { error: '정원은 2명 이상이어야 합니다.' })
    .max(10, { error: '정원은 10명까지 가능합니다.' }),
})

export const roomWriteSchema = roomFormSchema.transform((value) => ({
  title: value.title,
  location: value.location,
  scheduled_at: localDateTimeToIso(value.scheduled_at),
  max_participants: value.max_participants,
}))

export type RoomFormValues = z.input<typeof roomWriteSchema>
export type RoomWriteDto = z.output<typeof roomWriteSchema>

export function defaultRoomValues(now = new Date()): RoomFormValues {
  const start = new Date(now)
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)

  return {
    title: '',
    location: '',
    scheduled_at: toLocalInputValue(start),
    max_participants: 4,
  }
}
