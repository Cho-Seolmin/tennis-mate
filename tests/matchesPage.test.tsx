import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MatchesPage } from '../src/features/matches/MatchesPage.tsx'

const me = '11111111-1111-4111-8111-111111111111'
const opponentId = '22222222-2222-4222-8222-222222222222'

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
    profile: { nickname: '테스터' },
    email: 'player@example.com',
    userQuery: { isPending: false, isError: false, refetch: vi.fn() },
    accountQuery: { isPending: false, isError: false, refetch: vi.fn(), data: { nickname: '테스터' } },
  }),
}))

vi.mock('../src/features/matches/matchApi.ts', () => ({
  matchesQueryKey: (userId: string) => ['matches', userId],
  opponentsQueryKey: (userId: string) => ['match-opponents', userId],
  fetchOpponents: vi.fn(async () => [{ id: opponentId, nickname: '상대' }]),
  fetchMatches: vi.fn(async () => []),
  settleMatch: vi.fn(),
}))

vi.mock('../src/features/ranking/rankingApi.ts', () => ({
  rankingQueryKey: ['ranking'],
  refreshRanking: vi.fn(async () => ({ status: 'success', playerCount: 2, message: '랭킹을 갱신했습니다.' })),
  fetchRankingPage: vi.fn(),
}))

import { settleMatch } from '../src/features/matches/matchApi.ts'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

  render(<MatchesPage />, { wrapper: Wrapper })
}

describe('match transfer form', () => {
  it('rejects an amount outside 0 to 100 TNS before sending', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('option', { name: '상대' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('상대 사용자'), opponentId)
    await user.clear(screen.getByLabelText('전송 토큰 수량'))
    await user.type(screen.getByLabelText('전송 토큰 수량'), '0')
    await user.click(screen.getByRole('button', { name: '토큰 보내기' }))

    expect(await screen.findByText('전송 수량은 0보다 크고 100 TNS 이하여야 합니다.')).toBeInTheDocument()
    expect(settleMatch).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('전송 토큰 수량'))
    await user.type(screen.getByLabelText('전송 토큰 수량'), '101')
    await user.click(screen.getByRole('button', { name: '토큰 보내기' }))

    expect(await screen.findByText('전송 수량은 0보다 크고 100 TNS 이하여야 합니다.')).toBeInTheDocument()
    expect(settleMatch).not.toHaveBeenCalled()
  })

  it('rejects a result where the signed-in user is the winner', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('option', { name: '상대' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('상대 사용자'), opponentId)
    await user.click(screen.getByRole('radio', { name: '내가 이겼습니다' }))
    await user.click(screen.getByRole('button', { name: '토큰 보내기' }))

    expect(
      await screen.findByText('토큰은 패자 계정에서만 보낼 수 있습니다. 상대가 패자라면 상대 계정으로 로그인해 주세요.'),
    ).toBeInTheDocument()
    expect(settleMatch).not.toHaveBeenCalled()
  })

  it('asks the loser to send the default 5 TNS', async () => {
    const user = userEvent.setup()
    vi.mocked(settleMatch).mockResolvedValue({
      status: 'success',
      txHash: `0x${'ab'.repeat(32)}`,
      needsEth: false,
      message: '토큰을 승자에게 보냈습니다.',
    })
    renderPage()

    expect(await screen.findByRole('option', { name: '상대' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('상대 사용자'), opponentId)
    await user.click(screen.getByRole('button', { name: '토큰 보내기' }))

    expect(vi.mocked(settleMatch).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        winnerId: opponentId,
        loserId: me,
        amount: '5',
      }),
    )
    expect(await screen.findByRole('link', { name: 'Sepolia Etherscan에서 트랜잭션 보기' })).toBeInTheDocument()
  })

  it('shows a transfer failure and the faucet link without leaving the button stuck', async () => {
    const user = userEvent.setup()
    vi.mocked(settleMatch).mockResolvedValue({
      status: 'error',
      txHash: null,
      needsEth: true,
      message: 'Sepolia ETH가 부족합니다. Faucet에서 테스트 ETH를 받은 뒤 다시 시도해 주세요.',
    })
    renderPage()

    expect(await screen.findByRole('option', { name: '상대' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('상대 사용자'), opponentId)
    await user.click(screen.getByRole('button', { name: '토큰 보내기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sepolia ETH가 부족합니다.')
    expect(screen.getByRole('link', { name: 'Sepolia ETH Faucet 열기' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('실패')
    expect(screen.getByRole('button', { name: '토큰 보내기' })).toBeEnabled()
  })
})
