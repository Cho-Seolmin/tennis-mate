import type { WalletBalances } from './balanceApi.ts'
import { formatDisplayAmount } from './balanceApi.ts'

export type TokenView =
  | { kind: 'missing-wallet' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'disconnected' }
  | { kind: 'ready'; amount: string; symbol: string }

export function tokenViewFromQuery(
  address: string | null,
  query: {
    isPending: boolean
    isError: boolean
    error: unknown
    data?: WalletBalances
  },
): TokenView {
  if (!address) {
    return { kind: 'missing-wallet' }
  }

  if (query.isPending) {
    return { kind: 'loading' }
  }

  if (query.isError || !query.data) {
    return {
      kind: 'error',
      message:
        query.error instanceof Error ? query.error.message : 'Sepolia 잔액을 읽지 못했습니다.',
    }
  }

  if (query.data.token.status === 'disconnected') {
    return { kind: 'disconnected' }
  }

  if (query.data.token.status === 'error') {
    return { kind: 'error', message: query.data.token.message }
  }

  return {
    kind: 'ready',
    amount: formatDisplayAmount(query.data.token.amount),
    symbol: query.data.token.symbol,
  }
}
