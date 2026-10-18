import { useQuery } from '@tanstack/react-query'
import { authUserQueryKey } from '../auth/session.ts'
import { isSupabaseConfigured } from '../../lib/env.ts'
import { getCurrentUser, loadAccount } from '../../lib/supabase.ts'
import { readWalletBalances } from './balanceApi.ts'

export function useAccount() {
  const userQuery = useQuery({
    queryKey: authUserQueryKey,
    queryFn: getCurrentUser,
    enabled: isSupabaseConfigured,
  })
  const userId = userQuery.data?.id
  const accountQuery = useQuery({
    queryKey: ['account', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('로그인이 필요합니다.')
      }

      return loadAccount(userId)
    },
    enabled: Boolean(userId),
    retry: false,
  })

  return {
    userQuery,
    accountQuery,
    userId,
    profile: accountQuery.data,
    email: userQuery.data?.email ?? '',
  }
}

export function useWalletBalances(address: string | null) {
  return useQuery({
    queryKey: ['wallet-balances', address],
    queryFn: () => {
      if (!address) {
        throw new Error('지갑 주소가 없습니다.')
      }

      return readWalletBalances(address)
    },
    enabled: Boolean(address),
    retry: false,
  })
}
