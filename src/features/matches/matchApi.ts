import { FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabase } from '../../lib/supabase.ts'
import type { Match, MatchStatus } from '../../types/database.ts'
import { transferRequestSchema, type TransferRequest } from './transferSchema.ts'
import { tnsToWei } from '../../../supabase/functions/_shared/tns.ts'

const matchColumns = 'id, winner_id, loser_id, amount, status, tx_hash, played_at, created_at' as const

const settleResponseSchema = z.object({
  status: z.enum(['pending', 'confirming', 'success', 'error']),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).nullable(),
  needsEth: z.boolean(),
  message: z.string().min(1).max(180),
})

export type SettleResponse = z.infer<typeof settleResponseSchema>

const opponentSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  nickname: z.string().min(1),
})

export function matchesQueryKey(userId: string) {
  return ['matches', userId] as const
}

export function opponentsQueryKey(userId: string) {
  return ['match-opponents', userId] as const
}

export async function fetchOpponents() {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { data, error } = await supabase.rpc('list_match_opponents')

  if (error) {
    throw new Error('상대 사용자를 불러오지 못했습니다.')
  }

  const parsed = z.array(opponentSchema).safeParse(data)

  if (!parsed.success) {
    throw new Error('상대 사용자 목록을 확인하지 못했습니다.')
  }

  return parsed.data
}

export async function fetchMatches(userId: string) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('matches')
    .select(matchColumns)
    .or(`winner_id.eq.${userId},loser_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    throw new Error('경기 목록을 불러오지 못했습니다.')
  }

  return (data ?? []).map(parseMatch)
}

export async function settleMatch(request: TransferRequest) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const parsedRequest = transferRequestSchema.safeParse(request)

  if (!parsedRequest.success) {
    throw new Error(parsedRequest.error.issues[0]?.message ?? '전송 요청이 올바르지 않습니다.')
  }

  const { data, error } = await supabase.functions.invoke('settle-match', {
    body: parsedRequest.data,
  })

  if (error) {
    const body = await readErrorBody(error)

    if (body) {
      return body
    }

    throw new Error('토큰 전송 요청에 실패했습니다.')
  }

  const parsed = settleResponseSchema.safeParse(data)

  if (!parsed.success) {
    throw new Error('토큰 전송 응답을 확인하지 못했습니다.')
  }

  return parsed.data
}

function parseMatch(value: Match) {
  const amount = typeof value.amount === 'string' ? value.amount : String(value.amount)

  if (tnsToWei(normalizeAmount(amount)) === null || !isStatus(value.status)) {
    throw new Error('저장된 경기 결과를 확인하지 못했습니다.')
  }

  return { ...value, amount }
}

function normalizeAmount(amount: string) {
  const [whole, fraction = ''] = amount.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

function isStatus(value: string): value is MatchStatus {
  return value === 'pending' || value === 'confirming' || value === 'completed' || value === 'failed'
}

async function readErrorBody(error: unknown) {
  if (!(error instanceof FunctionsHttpError) || !(error.context instanceof Response)) {
    return null
  }

  try {
    const body: unknown = await error.context.clone().json()
    const parsed = settleResponseSchema.safeParse(body)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
