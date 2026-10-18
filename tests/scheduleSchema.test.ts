import { describe, expect, it } from 'vitest'
import { monthGrid, scheduleOverlapsDay, toLocalInputValue } from '../src/features/dashboard/dateTime.ts'
import {
  scheduleWriteSchema,
  type ScheduleFormValues,
  type ScheduleWriteDto,
} from '../src/features/dashboard/scheduleSchema.ts'
import { parseScheduleWrite } from '../src/features/dashboard/scheduleApi.ts'

const validInput: ScheduleFormValues = {
  title: '아침 연습',
  start_at: '2026-10-18T10:00',
  end_at: '2026-10-18T11:00',
  location: '한강 코트',
  memo: '서브 연습',
}

describe('schedule schema', () => {
  it('accepts a valid schedule and converts local time to ISO', () => {
    const parsed = scheduleWriteSchema.parse({
      title: ' 아침 연습 ',
      start_at: '2026-10-18T10:00',
      end_at: '2026-10-19T01:00',
      location: '   ',
      memo: ' 메모 ',
    })
    const dto: ScheduleWriteDto = parsed
    const start = new Date(dto.start_at)
    const end = new Date(dto.end_at)

    expect(dto.title).toBe('아침 연습')
    expect(dto.location).toBeNull()
    expect(dto.memo).toBe('메모')
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(9)
    expect(start.getDate()).toBe(18)
    expect(start.getHours()).toBe(10)
    expect(end.getTime()).toBeGreaterThan(start.getTime())
    expect(toLocalInputValue(start)).toBe('2026-10-18T10:00')
  })

  it('allows omitted location and memo', () => {
    const parsed = scheduleWriteSchema.parse({
      title: '연습',
      start_at: '2026-10-18T10:00',
      end_at: '2026-10-18T11:00',
    })

    expect(parsed.location).toBeNull()
    expect(parsed.memo).toBeNull()
  })

  it('rejects a missing title, an invalid date, and an end time that is not later', () => {
    expect(scheduleWriteSchema.safeParse({ ...validInput, title: '   ' }).success).toBe(false)
    expect(scheduleWriteSchema.safeParse({ ...validInput, title: '가'.repeat(101) }).success).toBe(false)
    expect(scheduleWriteSchema.safeParse({ ...validInput, start_at: '2026-02-31T10:00' }).success).toBe(false)
    expect(scheduleWriteSchema.safeParse({ ...validInput, location: '가'.repeat(201) }).success).toBe(false)
    expect(scheduleWriteSchema.safeParse({ ...validInput, memo: '가'.repeat(501) }).success).toBe(false)

    const reversed = scheduleWriteSchema.safeParse({
      ...validInput,
      start_at: '2026-10-18T11:00',
      end_at: '2026-10-18T10:00',
    })
    const sameTime = scheduleWriteSchema.safeParse({
      ...validInput,
      end_at: '2026-10-18T10:00',
    })

    expect(reversed.success).toBe(false)
    expect(sameTime.success).toBe(false)
    if (!reversed.success) {
      expect(reversed.error.issues.some((issue) => issue.message.includes('종료 시간'))).toBe(true)
    }
  })

  it('stops invalid input before a request is built', () => {
    expect(() =>
      parseScheduleWrite({
        title: '연습',
        start_at: '2026-10-18T11:00',
        end_at: '2026-10-18T10:00',
      }),
    ).toThrow('종료 시간은 시작 시간보다 늦어야 합니다.')
  })
})

describe('schedule dates', () => {
  it('builds October 2026 from the Sunday before the 1st', () => {
    const days = monthGrid(new Date(2026, 9, 1))

    expect(days).toHaveLength(42)
    expect(days[0]?.getMonth()).toBe(8)
    expect(days[0]?.getDate()).toBe(27)
    expect(days[4]?.getMonth()).toBe(9)
    expect(days[4]?.getDate()).toBe(1)
  })

  it('includes an event on every local day it overlaps', () => {
    const schedule = {
      start_at: new Date(2026, 9, 17, 23, 0).toISOString(),
      end_at: new Date(2026, 9, 18, 1, 0).toISOString(),
    }

    expect(scheduleOverlapsDay(schedule, new Date(2026, 9, 17))).toBe(true)
    expect(scheduleOverlapsDay(schedule, new Date(2026, 9, 18))).toBe(true)
    expect(scheduleOverlapsDay(schedule, new Date(2026, 9, 19))).toBe(false)
  })
})
