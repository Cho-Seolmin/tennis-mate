import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../../components/layout/PageHeader.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { DemoModeNotice } from '../../components/ui/DemoModeNotice.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { isSupabaseConfigured, isTokenConfigured } from '../../lib/env.ts'
import { useAccount, useWalletBalances } from '../dashboard/useAccount.ts'
import { TokenBalanceView } from '../dashboard/TokenBalanceView.tsx'
import { tokenViewFromQuery } from '../dashboard/tokenView.ts'
import { AttendanceCard } from './AttendanceCard.tsx'
import { claimAttendance, fetchAttendance } from './attendanceApi.ts'
import { rewardView } from './rewardState.ts'
import { seoulDate } from './seoulDate.ts'

export function RewardsPage() {
  if (!isTokenConfigured) {
    return (
      <section className="space-y-6">
        <PageHeader
          title="보상"
          description="Sepolia 테스트 토큰의 잔액과 하루 한 번 출석 보상이 놓일 화면입니다. 계약 주소가 없으면 수량을 표시하지 않습니다."
        />
        <DemoModeNotice
          service="Sepolia"
          detail="토큰 계약 주소가 없어 잔액, 보상, 전송을 조회하지 않습니다."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <h2 className="text-base font-semibold text-ink">잔액</h2>
            <div className="mt-4">
              <EmptyState
                title="잔액 없음"
                description="체인에서 읽어 오기 전에는 0을 포함한 어떤 수량도 보여 주지 않습니다."
              />
            </div>
          </Card>
          <Card>
            <h2 className="text-base font-semibold text-ink">오늘 출석</h2>
            <div className="mt-4">
              <EmptyState
                title="출석 보상 없음"
                description="Tennis Token 계약이 배포되기 전에는 보상을 지급하지 않습니다."
              />
            </div>
          </Card>
        </div>
      </section>
    )
  }

  return <ConfiguredRewards />
}

function ConfiguredRewards() {
  const queryClient = useQueryClient()
  const [rewardDate] = useState(() => seoulDate())
  const { userQuery, accountQuery, userId, profile } = useAccount()
  const address = profile?.wallet_address ?? null
  const balanceQuery = useWalletBalances(address)
  const attendanceQuery = useQuery({
    queryKey: ['attendance', userId, rewardDate],
    queryFn: () => {
      if (!userId) {
        throw new Error('로그인이 필요합니다.')
      }

      return fetchAttendance(userId, rewardDate)
    },
    enabled: Boolean(userId),
    retry: false,
  })
  const view = rewardView(attendanceQuery.data ?? null)
  const syncQuery = useQuery({
    queryKey: ['attendance-sync', userId, rewardDate, attendanceQuery.data?.status, attendanceQuery.data?.tx_hash],
    queryFn: async () => {
      const result = await claimAttendance()

      if (result.status === 'success' || result.status === 'error') {
        await queryClient.invalidateQueries({ queryKey: ['attendance', userId, rewardDate] })
        await queryClient.invalidateQueries({ queryKey: ['wallet-balances', address] })
      }

      return result
    },
    enabled: Boolean(userId) && view.status === 'confirming',
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'success' || status === 'error' ? false : 4000
    },
    retry: false,
  })
  const claimMutation = useMutation({
    mutationFn: claimAttendance,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance', userId, rewardDate] })
      await queryClient.invalidateQueries({ queryKey: ['wallet-balances', address] })
    },
  })

  if (!isSupabaseConfigured) {
    return (
      <ErrorMessage
        title="출석 보상을 사용할 수 없습니다"
        message="Supabase URL과 anon key가 설정되지 않았습니다."
      />
    )
  }

  if (userQuery.isPending || (userId && accountQuery.isPending)) {
    return <Loading label="계정과 지갑을 확인하고 있습니다" />
  }

  if (!userId || accountQuery.isError || !profile) {
    return (
      <ErrorMessage
        title="계정 정보를 불러오지 못했습니다"
        message={
          accountQuery.error instanceof Error ? accountQuery.error.message : '다시 로그인해 주세요.'
        }
        onRetry={() => {
          void accountQuery.refetch()
        }}
      />
    )
  }

  const claimError = claimMutation.error instanceof Error ? claimMutation.error.message : null
  const syncError = syncQuery.error instanceof Error ? syncQuery.error.message : null
  const responseMessage =
    claimMutation.data?.status === 'error' || claimMutation.data?.status === 'success'
      ? claimMutation.data.message
      : null
  const shownView = {
    ...view,
    status: claimMutation.data?.status === 'error' && view.status === 'idle' ? ('error' as const) : view.status,
    message: claimError ?? responseMessage ?? syncError ?? view.message,
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="보상"
        description="서울 날짜 기준으로 하루에 한 번 10 TNS를 받습니다. 테스트넷 명예 토큰이며 상업적 가치는 없습니다."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <TokenBalanceView
            status={tokenViewFromQuery(address, balanceQuery)}
            onRetry={() => {
              void balanceQuery.refetch()
            }}
          />
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-ink">오늘 출석</h2>
          <div className="mt-4">
            {attendanceQuery.isPending ? <Loading label="출석 상태를 확인하는 중" /> : null}
            {attendanceQuery.isError ? (
              <ErrorMessage
                title="출석 상태를 불러오지 못했습니다"
                message={
                  attendanceQuery.error instanceof Error
                    ? attendanceQuery.error.message
                    : '다시 시도해 주세요.'
                }
                onRetry={() => {
                  void attendanceQuery.refetch()
                }}
              />
            ) : null}
            {!attendanceQuery.isPending && !attendanceQuery.isError ? (
              <AttendanceCard
                view={shownView}
                submitting={claimMutation.isPending}
                onClaim={() => {
                  claimMutation.mutate()
                }}
              />
            ) : null}
          </div>
        </Card>
      </div>
    </section>
  )
}
