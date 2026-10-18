import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDisplayAmount, readWalletBalances } from '../src/features/dashboard/balanceApi.ts'
import { sepoliaFaucetUrl } from '../src/features/dashboard/faucet.ts'
import { TokenBalanceView } from '../src/features/dashboard/TokenBalanceView.tsx'
import { tokenViewFromQuery } from '../src/features/dashboard/tokenView.ts'
import { WalletPanel } from '../src/features/dashboard/WalletPanel.tsx'

vi.mock('../src/features/dashboard/balanceApi.ts', async () => {
  const actual = await vi.importActual<typeof import('../src/features/dashboard/balanceApi.ts')>(
    '../src/features/dashboard/balanceApi.ts',
  )

  return {
    ...actual,
    readWalletBalances: vi.fn(),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('token balance display', () => {
  it('formats a real balance and keeps very small values visible', () => {
    expect(formatDisplayAmount('0')).toBe('0')
    expect(formatDisplayAmount('1.23456789')).toBe('1.234567')
    expect(formatDisplayAmount('0.00000012')).toBe('< 0.000001')
  })

  it('shows a disconnected token without a quantity', () => {
    const status = tokenViewFromQuery('0xabc', {
      isPending: false,
      isError: false,
      error: null,
      data: { eth: '1', token: { status: 'disconnected' } },
    })

    render(<TokenBalanceView status={status} />)

    expect(screen.getByText('미연결')).toBeInTheDocument()
    expect(screen.getByText(/잔액을 표시하지 않습니다/)).toBeInTheDocument()
    expect(screen.queryByText(/^0/)).not.toBeInTheDocument()
  })
})

describe('wallet panel', () => {
  it('copies the real address and shows ETH beside a disconnected token', async () => {
    const user = userEvent.setup()
    const address = `0x${'ab'.repeat(20)}`
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    vi.mocked(readWalletBalances).mockResolvedValue({
      eth: '1.25',
      token: { status: 'disconnected' },
    })

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <WalletPanel address={address} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('1.25 ETH')).toBeInTheDocument()
    expect(screen.getByText(address)).toBeInTheDocument()
    expect(screen.getByText('미연결')).toBeInTheDocument()
    expect(screen.queryByText('0 TNS')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sepolia ETH 받기' })).toHaveAttribute('href', sepoliaFaucetUrl)
    expect(screen.getByRole('link', { name: 'Sepolia ETH 받기' })).toHaveAttribute('target', '_blank')

    await user.click(screen.getByRole('button', { name: '주소 복사' }))
    expect(writeText).toHaveBeenCalledWith(address)
  })

  it('shows a balance error without inventing zero', async () => {
    vi.mocked(readWalletBalances).mockRejectedValue(new Error('Sepolia ETH 잔액을 읽지 못했습니다.'))

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <WalletPanel address={`0x${'cd'.repeat(20)}`} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Sepolia ETH 잔액을 읽지 못했습니다.')).toBeInTheDocument()
    expect(screen.queryByText('0 ETH')).not.toBeInTheDocument()
    expect(screen.queryByText('미연결')).not.toBeInTheDocument()
  })
})
