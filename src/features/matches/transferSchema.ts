import { z } from 'zod'
import { isValidLocalDateTime } from '../dashboard/dateTime.ts'
import { isTransferTimestamp } from '../../../supabase/functions/_shared/transfer.ts'
import { tnsToWei } from '../../../supabase/functions/_shared/tns.ts'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const amountMessage = '전송 수량은 0보다 크고 100 TNS 이하여야 합니다.'

export const transferRequestSchema = z
  .object({
    matchId: z.string().regex(uuidPattern, { error: '경기 번호가 올바르지 않습니다.' }),
    winnerId: z.string().regex(uuidPattern, { error: '승자를 선택해 주세요.' }),
    loserId: z.string().regex(uuidPattern, { error: '패자를 선택해 주세요.' }),
    amount: z.string().trim().refine((value) => tnsToWei(value) !== null, { error: amountMessage }),
    playedAt: z.string().refine(isTransferTimestamp, { error: '경기 날짜를 입력해 주세요.' }),
  })
  .refine((value) => value.winnerId !== value.loserId, {
    error: '승자와 패자는 서로 달라야 합니다.',
    path: ['loserId'],
  })

export type TransferRequest = z.infer<typeof transferRequestSchema>

export const matchFormSchema = z
  .object({
    opponentId: z.string().regex(uuidPattern, { error: '상대 사용자를 선택해 주세요.' }),
    result: z.enum(['opponent_won', 'i_won'], { error: '승자를 선택해 주세요.' }),
    playedAt: z.string().refine(isValidLocalDateTime, { error: '경기 날짜를 입력해 주세요.' }),
    amount: z.string().trim().refine((value) => tnsToWei(value) !== null, { error: amountMessage }),
  })
  .superRefine((value, ctx) => {
    if (value.result === 'i_won') {
      ctx.addIssue({
        code: 'custom',
        path: ['result'],
        message: '토큰은 패자 계정에서만 보낼 수 있습니다. 상대가 패자라면 상대 계정으로 로그인해 주세요.',
      })
    }
  })

export type MatchFormValues = z.infer<typeof matchFormSchema>

export function transferFromForm(values: MatchFormValues, userId: string, matchId: string, playedAt: string) {
  return transferRequestSchema.safeParse({
    matchId,
    winnerId: values.opponentId,
    loserId: userId,
    amount: values.amount.trim(),
    playedAt,
  })
}

export const transferPhases = ['idle', 'requesting', 'processing', 'confirming', 'success', 'error'] as const

export type TransferPhase = (typeof transferPhases)[number]

export const transferPhaseLabel: Record<TransferPhase, string> = {
  idle: '입력',
  requesting: '전송 요청',
  processing: '처리 중',
  confirming: '블록 확인 중',
  success: '성공',
  error: '실패',
}

export function transferPhase(pending: boolean, status: 'pending' | 'confirming' | 'success' | 'error' | null) {
  if (pending) {
    return 'requesting' satisfies TransferPhase
  }

  if (status === 'pending') {
    return 'processing' satisfies TransferPhase
  }

  if (status === 'confirming') {
    return 'confirming' satisfies TransferPhase
  }

  if (status === 'success') {
    return 'success' satisfies TransferPhase
  }

  if (status === 'error') {
    return 'error' satisfies TransferPhase
  }

  return 'idle' satisfies TransferPhase
}
