import type { Schedule } from '../../types/database.ts'
import { supabase } from '../../lib/supabase.ts'
import { scheduleRowError } from './dbError.ts'
import { scheduleWriteSchema, type ScheduleWriteDto } from './scheduleSchema.ts'

const scheduleColumns =
  'id, user_id, title, start_at, end_at, location, memo, created_at' as const

export function parseScheduleWrite(input: unknown): ScheduleWriteDto {
  const parsed = scheduleWriteSchema.safeParse(input)

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? '일정 값을 확인해 주세요.')
  }

  return parsed.data
}

export async function fetchSchedules(userId: string, rangeStart: Date, rangeEnd: Date) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('schedules')
    .select(scheduleColumns)
    .eq('user_id', userId)
    .lt('start_at', rangeEnd.toISOString())
    .gt('end_at', rangeStart.toISOString())
    .order('start_at', { ascending: true })

  if (error) {
    throw new Error(scheduleRowError(error, '일정을 불러오지 못했습니다.'))
  }

  return data ?? []
}

export async function createSchedule(userId: string, input: unknown) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const dto = parseScheduleWrite(input)
  const { data, error } = await supabase
    .from('schedules')
    .insert({
      user_id: userId,
      title: dto.title,
      start_at: dto.start_at,
      end_at: dto.end_at,
      location: dto.location,
      memo: dto.memo,
    })
    .select(scheduleColumns)
    .single()

  if (error) {
    throw new Error(scheduleRowError(error, '일정을 저장하지 못했습니다.'))
  }

  return data
}

export async function updateSchedule(id: string, userId: string, input: unknown) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const dto = parseScheduleWrite(input)
  const { data, error } = await supabase
    .from('schedules')
    .update({
      title: dto.title,
      start_at: dto.start_at,
      end_at: dto.end_at,
      location: dto.location,
      memo: dto.memo,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select(scheduleColumns)
    .maybeSingle()

  if (error) {
    throw new Error(scheduleRowError(error, '일정을 수정하지 못했습니다.'))
  }

  if (!data) {
    throw new Error('본인 일정만 수정할 수 있습니다.')
  }

  return data
}

export async function deleteSchedule(id: string, userId: string) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')

  if (error) {
    throw new Error(scheduleRowError(error, '일정을 삭제하지 못했습니다.'))
  }

  if (!data || data.length === 0) {
    throw new Error('본인 일정만 삭제할 수 있습니다.')
  }
}

export type { Schedule }
