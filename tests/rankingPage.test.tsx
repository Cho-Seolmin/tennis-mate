import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RankingPage } from '../src/features/ranking/RankingPage.tsx'
import type { RankingPage as RankingPageData } from '../src/types/database.ts'

const me = '11111111-1111-4111-8111-111111111111'

vi.mock('../src/lib/env.ts', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/env.ts')>('../src/lib/env.ts')

  return {
    ...actual,
    isTokenConfigured: true,
    isSupabaseConfigured: true,
  }
})

vi.mock('../src/features/dashboard/useAccount.ts', () => ({
  useAccount: () => ({
    userId: me,
    userQuery: { isPending: false, isError: false, refetch: vi.fn() },
  }),
}))

vi.mock('../src/features/ranking/rankingApi.ts', () => ({
  rankingQueryKey: ['ranking'],
  fetchRankingPage: vi.fn(),
  refreshRanking: vi.fn(),
}))

import { fetchRankingPage } from '../src/features/ranking/rankingApi.ts'

const originalObserver = window.IntersectionObserver

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    value: originalObserver,
  })
})

function page(startRank: number, size: number, hasMore: boolean, extra: RankingPageData['entries'] = []): RankingPageData {
  const entries = Array.from({ length: size }, (_, index) => {
    const rank = startRank + index
    return {
      userId: `00000000-0000-4000-8000-${String(rank).padStart(12, '0')}`,
      nickname: `선수${String(rank).padStart(2, '0')}`,
      balanceWei: `${BigInt(100 - rank) * 10n ** 18n}`,
      rank,
    }
  })

  return {
    snapshotId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    createdAt: '2026-10-18T01:00:00.000Z',
    myRank: 4,
    myBalanceWei: `${10n * 10n ** 18n}`,
    hasMore,
    entries: [...entries, ...extra],
  }
}

function renderPage() {
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    value: undefined,
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

  render(<RankingPage />, { wrapper: Wrapper })
}

describe('ranking infinite scroll', () => {
  it('loads 20 people and the next 20, then stops', async () => {
    const user = userEvent.setup()
    const first = page(1, 20, true)
    const duplicate = first.entries[0]
    const second = page(21, 19, false, [duplicate])
    vi.mocked(fetchRankingPage).mockImplementation(async (afterRank) => {
      if (afterRank === 0) {
        return first
      }

      if (afterRank === 20) {
        return second
      }

      throw new Error('마지막 페이지 이후에 요청했습니다.')
    })
    renderPage()

    expect(await screen.findByText('4위 · 10 TNS')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(20)
    expect(screen.getByText('TOP 1')).toBeInTheDocument()

    const fetchedAt = screen.getByText(/마지막 조회/).textContent
    await user.click(screen.getByRole('button', { name: '더 보기' }))

    expect(await screen.findByText('39. 선수39')).toBeInTheDocument()
    expect(screen.getByText(/마지막 조회/).textContent).toBe(fetchedAt)
    expect(screen.getAllByRole('listitem')).toHaveLength(39)
    expect(screen.getAllByRole('listitem').filter((item) => item.textContent?.includes('선수01'))).toHaveLength(1)
    expect(screen.getByText('마지막 순위까지 표시했습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument()
    expect(fetchRankingPage).toHaveBeenCalledTimes(2)
  })

  it('does not request the next page twice while the first request is still running', async () => {
    const user = userEvent.setup()
    let release: ((page: RankingPageData) => void) | undefined
    vi.mocked(fetchRankingPage).mockImplementation(async (afterRank) => {
      if (afterRank === 0) {
        return page(1, 20, true)
      }

      return new Promise((resolve) => {
        release = resolve
      })
    })
    renderPage()

    expect(await screen.findByRole('button', { name: '더 보기' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '더 보기' }))
    expect(await screen.findByText('다음 순위를 불러오는 중')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '더 보기' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '더 보기' }))
    expect(fetchRankingPage).toHaveBeenCalledTimes(2)

    release?.(page(21, 1, false))
    expect(await screen.findByText('마지막 순위까지 표시했습니다.')).toBeInTheDocument()
  })

  it('retries a failed next page without replacing the current snapshot', async () => {
    const user = userEvent.setup()
    let failed = false
    vi.mocked(fetchRankingPage).mockImplementation(async (afterRank) => {
      if (afterRank === 0) {
        return page(1, 20, true)
      }

      if (!failed) {
        failed = true
        throw new Error('랭킹을 불러오지 못했습니다.')
      }

      return page(21, 1, false)
    })
    renderPage()

    const fetchedAt = (await screen.findByText(/마지막 조회/)).textContent
    await user.click(await screen.findByRole('button', { name: '더 보기' }))
    expect(await screen.findByRole('heading', { name: '다음 순위를 불러오지 못했습니다' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('21. 선수21')).toBeInTheDocument()
    expect(screen.getByText(/마지막 조회/).textContent).toBe(fetchedAt)
    expect(screen.getByText('마지막 순위까지 표시했습니다.')).toBeInTheDocument()
  })

  it('loads the next page when the list end enters the viewport', async () => {
    vi.mocked(fetchRankingPage).mockImplementation(async (afterRank) => {
      if (afterRank === 0) {
        return page(1, 20, true)
      }

      if (afterRank === 20) {
        return page(21, 1, false)
      }

      throw new Error('마지막 페이지 이후에 요청했습니다.')
    })
    class ViewportObserver {
      private readonly callback: IntersectionObserverCallback

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }

      observe() {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        )
      }

      disconnect() {}

      unobserve() {}

      takeRecords() {
        return []
      }
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: ViewportObserver,
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }

    render(<RankingPage />, { wrapper: Wrapper })

    expect(await screen.findByText('21. 선수21')).toBeInTheDocument()
    expect(screen.getByText('마지막 순위까지 표시했습니다.')).toBeInTheDocument()
    expect(fetchRankingPage).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument()
  })
})
