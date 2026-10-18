import { FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabase } from '../../lib/supabase.ts'
import type { RankingPage } from '../../types/database.ts'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const rankingPageSchema = z.object({
  snapshotId: z.string().regex(uuidPattern).nullable(),
  createdAt: z.string().nullable(),
  myRank: z.number().int().positive().nullable(),
  myBalanceWei: z.string().regex(/^\d+$/).nullable(),
  hasMore: z.boolean(),
  entries: z.array(
    z.object({
      userId: z.string().regex(uuidPattern),
      nickname: z.string().min(1),
      balanceWei: z.string().regex(/^\d+$/),
      rank: z.number().int().positive(),
    }),
  ),
})

const refreshSchema = z.object({
  status: z.enum(['success', 'error']),
  playerCount: z.number().int().nonnegative().nullable(),
  message: z.string().min(1).max(180),
})

export const rankingQueryKey = ['ranking'] as const

export async function fetchRankingPage(afterRank: number) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  if (!Number.isInteger(afterRank) || afterRank < 0) {
    throw new Error('랭킹 페이지를 확인하지 못했습니다.')
  }

  const { data, error } = await supabase.rpc('list_ranking_page', {
    p_after_rank: afterRank,
    p_page_size: 20,
  })

  if (error) {
    throw new Error('랭킹을 불러오지 못했습니다.')
  }

  const parsed = rankingPageSchema.safeParse(data)

  if (!parsed.success) {
    throw new Error('랭킹 응답을 확인하지 못했습니다.')
  }

  return parsed.data satisfies RankingPage
}

export async function refreshRanking() {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { data, error } = await supabase.functions.invoke('refresh-ranking', { body: {} })

  if (error) {
    throw new Error(await messageFromFunctionError(error))
  }

  const parsed = refreshSchema.safeParse(data)

  if (!parsed.success || parsed.data.status === 'error') {
    throw new Error(parsed.success ? parsed.data.message : '랭킹을 갱신하지 못했습니다.')
  }

  return parsed.data
}

async function messageFromFunctionError(error: unknown) {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json()

      if (isRecord(body) && typeof body.message === 'string' && body.message.length <= 180) {
        return body.message
      }
    } catch {
      return '랭킹을 갱신하지 못했습니다.'
    }
  }

  return '랭킹을 갱신하지 못했습니다.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
