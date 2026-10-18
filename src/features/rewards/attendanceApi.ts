import { FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabase } from '../../lib/supabase.ts'
import type { Attendance } from '../../types/database.ts'
import { isRewardAmount } from './rewardState.ts'

const attendanceColumns = 'id, user_id, reward_date, amount, tx_hash, status, locked_until' as const

const claimResponseSchema = z.object({
  status: z.enum(['pending', 'confirming', 'success', 'error']),
  txHash: z.string().nullable(),
  rewardDate: z.string().nullable(),
  message: z.string().min(1),
})

export type ClaimResponse = z.infer<typeof claimResponseSchema>

export async function fetchAttendance(userId: string, rewardDate: string) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('attendance')
    .select(attendanceColumns)
    .eq('user_id', userId)
    .eq('reward_date', rewardDate)
    .maybeSingle()

  if (error) {
    throw new Error('출석 상태를 불러오지 못했습니다.')
  }

  if (!data) {
    return null
  }

  return parseAttendance(data)
}

export async function claimAttendance() {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { data, error } = await supabase.functions.invoke('claim-attendance', {
    body: {},
  })

  if (error) {
    throw new Error(await messageFromFunctionError(error))
  }

  const parsed = claimResponseSchema.safeParse(data)

  if (!parsed.success) {
    throw new Error('출석 보상 응답을 확인하지 못했습니다.')
  }

  return parsed.data
}

function parseAttendance(value: Attendance) {
  if (!isRewardAmount(value.amount)) {
    throw new Error('출석 보상 수량이 서버 규칙과 다릅니다.')
  }

  return value
}

async function messageFromFunctionError(error: unknown) {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json()

      if (isRecord(body) && typeof body.message === 'string') {
        return safeMessage(body.message)
      }

      if (isRecord(body) && typeof body.error === 'string') {
        return safeMessage(body.error)
      }
    } catch {
      return '출석 보상을 지급하지 못했습니다.'
    }
  }

  if (error instanceof Error && error.message) {
    return safeMessage(error.message)
  }

  return '출석 보상을 지급하지 못했습니다.'
}

function safeMessage(message: string) {
  if (message.length > 180 || /private|secret|mnemonic|0x[0-9a-fA-F]{64}/i.test(message)) {
    return '출석 보상을 지급하지 못했습니다.'
  }

  return message
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
