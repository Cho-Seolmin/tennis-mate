import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { PageHeader } from '../../components/layout/PageHeader.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { DemoModeNotice } from '../../components/ui/DemoModeNotice.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { isTokenConfigured } from '../../lib/env.ts'
import { useAccount } from '../dashboard/useAccount.ts'
import { fetchRankingPage, rankingQueryKey, refreshRanking } from './rankingApi.ts'
import { dedupedRankingEntries, formatRankingBalance } from './rankingView.ts'

export function RankingPage() {
  if (!isTokenConfigured) {
    return (
      <section className="space-y-6">
        <PageHeader
          title="랭킹"
          description="등록된 사용자의 TNS 잔액 순위입니다. 계약 주소가 없으면 순위를 계산하지 않습니다."
        />
        <DemoModeNotice
          service="Sepolia"
          detail="토큰 계약 주소가 없어 잔액 순위를 조회하지 않습니다."
        />
        <Card>
          <EmptyState title="랭킹이 없습니다" description="체인 잔액을 읽기 전에는 순위와 수량을 만들지 않습니다." />
        </Card>
      </section>
    )
  }

  return <ConfiguredRanking />
}

function ConfiguredRanking() {
  const { userId, userQuery } = useAccount()

  if (userQuery.isPending) {
    return <Loading label="랭킹을 불러오는 중" />
  }

  if (!userId) {
    return (
      <ErrorMessage
        title="랭킹을 불러오지 못했습니다"
        message="로그인 상태를 확인한 뒤 다시 시도해 주세요."
        onRetry={() => {
          void userQuery.refetch()
        }}
      />
    )
  }

  return <RankingList userId={userId} />
}

function RankingList({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const ranking = useInfiniteQuery({
    queryKey: rankingQueryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchRankingPage(pageParam),
    getNextPageParam: (page) => {
      const lastRank = page.entries.at(-1)?.rank

      if (!page.hasMore || lastRank === undefined) {
        return undefined
      }

      return lastRank
    },
  })
  const refresh = useMutation({
    mutationFn: refreshRanking,
    onSuccess: async () => {
      await queryClient.resetQueries({ queryKey: rankingQueryKey })
    },
  })
  const hasNextPage = ranking.hasNextPage
  const isFetchingNextPage = ranking.isFetchingNextPage
  const fetchNextPage = ranking.fetchNextPage
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])
  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerReady = typeof IntersectionObserver !== 'undefined'

  useEffect(() => {
    const node = sentinelRef.current

    if (!node || !observerReady || !ranking.hasNextPage) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore()
        }
      },
      { rootMargin: '160px' },
    )
    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [loadMore, observerReady, ranking.hasNextPage])

  if (ranking.isPending) {
    return <Loading label="랭킹을 불러오는 중" />
  }

  const hasPages = (ranking.data?.pages.length ?? 0) > 0

  if (ranking.isError && !hasPages) {
    return (
      <ErrorMessage
        title="랭킹을 불러오지 못했습니다"
        message="잔액 스냅샷을 다시 조회해 주세요."
        onRetry={() => {
          void ranking.refetch()
        }}
      />
    )
  }

  const pages = ranking.data?.pages ?? []
  const entries = dedupedRankingEntries(pages.map((page) => page.entries))
  const latest = pages[0]
  const top3 = entries.filter((entry) => entry.rank <= 3)
  const fetchedAt = latest?.createdAt ? formatFetchedAt(latest.createdAt) : null
  const myBalance = latest?.myBalanceWei ? formatRankingBalance(latest.myBalanceWei) : null

  return (
    <section className="space-y-6">
      <PageHeader
        title="랭킹"
        description="Tennis Mate에 등록되고 지갑이 있는 사용자의 Sepolia TNS 잔액 순위입니다. 조회 버튼을 누른 시점의 잔액입니다."
      />
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">나의 현재 순위</h2>
            <p className="mt-1 text-sm text-ink/70">
              {latest?.myRank ? `${latest.myRank}위` : '순위 없음'}
              {myBalance ? ` · ${myBalance} TNS` : ''}
            </p>
            <p className="mt-1 text-sm text-ink/70">
              {fetchedAt ? `마지막 조회 ${fetchedAt}` : '아직 랭킹을 조회하지 않았습니다.'}
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={refresh.isPending}
            onClick={() => {
              refresh.mutate()
            }}
          >
            {refresh.isPending ? '잔액 조회 중' : '랭킹 새로고침'}
          </Button>
        </div>
        {refresh.isError ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {refresh.error instanceof Error ? refresh.error.message : '랭킹을 갱신하지 못했습니다.'}
          </p>
        ) : null}
      </Card>
      {entries.length === 0 ? (
        <Card>
          <EmptyState
            title="랭킹이 없습니다"
            description="랭킹 새로고침을 누르면 등록된 지갑의 TNS 잔액을 읽어 순위를 만듭니다."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {top3.map((entry) => (
              <Card key={entry.userId} className={entry.userId === userId ? 'bg-ball' : ''}>
                <p className="text-sm font-semibold text-court-800">TOP {entry.rank}</p>
                <p className="mt-2 text-lg font-semibold text-ink">{entry.nickname}</p>
                <p className="mt-1 text-sm text-ink/70">{formatRankingBalance(entry.balanceWei) ?? '잔액 확인 불가'} TNS</p>
              </Card>
            ))}
          </div>
          <Card>
            <h2 className="text-base font-semibold text-ink">전체 순위</h2>
            <ol className="mt-4 space-y-2">
              {entries.map((entry) => {
                const balance = formatRankingBalance(entry.balanceWei)

                return (
                  <li
                    key={entry.userId}
                    aria-current={entry.userId === userId ? 'true' : undefined}
                    className={[
                      'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3',
                      entry.userId === userId ? 'border-court-700 bg-ball' : 'border-line',
                    ].join(' ')}
                  >
                    <span className="text-sm font-semibold text-ink">
                      {entry.rank}. {entry.nickname}
                      {entry.userId === userId ? ' · 나' : ''}
                    </span>
                    <span className="text-sm text-ink/70">{balance ?? '잔액 확인 불가'} TNS</span>
                  </li>
                )
              })}
            </ol>
            <div ref={sentinelRef} className="mt-4">
              {ranking.isFetchingNextPage ? <Loading label="다음 순위를 불러오는 중" /> : null}
              {ranking.isFetchNextPageError ? (
                <ErrorMessage
                  title="다음 순위를 불러오지 못했습니다"
                  message="같은 위치에서 다시 시도해 주세요."
                  onRetry={loadMore}
                />
              ) : null}
              {!observerReady && ranking.hasNextPage ? (
                <Button variant="secondary" disabled={ranking.isFetchingNextPage} onClick={loadMore}>
                  더 보기
                </Button>
              ) : null}
              {!ranking.hasNextPage ? (
                <p className="text-sm text-ink/70">마지막 순위까지 표시했습니다.</p>
              ) : null}
            </div>
          </Card>
        </>
      )}
    </section>
  )
}

function formatFetchedAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
