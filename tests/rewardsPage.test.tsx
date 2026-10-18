import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AttendanceCard } from '../src/features/rewards/AttendanceCard.tsx'

afterEach(() => {
  cleanup()
})

describe('attendance card', () => {
  it('disables the button after a completed claim and links the transaction', async () => {
    const user = userEvent.setup()
    const onClaim = vi.fn()
    const txHash = `0x${'cd'.repeat(32)}`

    render(
      <AttendanceCard
        submitting={false}
        onClaim={onClaim}
        view={{
          status: 'success',
          txHash,
          message: '오늘 10 TNS 출석 보상을 받았습니다.',
        }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('오늘 10 TNS 출석 보상을 받았습니다.')
    expect(screen.getByRole('button', { name: '오늘 출석 완료' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Sepolia Etherscan에서 보기' })).toHaveAttribute(
      'href',
      `https://sepolia.etherscan.io/tx/${txHash}`,
    )

    await user.click(screen.getByRole('button', { name: '오늘 출석 완료' }))
    expect(onClaim).not.toHaveBeenCalled()
  })

  it('lets the user retry after an error', async () => {
    const user = userEvent.setup()
    const onClaim = vi.fn()

    render(
      <AttendanceCard
        submitting={false}
        onClaim={onClaim}
        view={{ status: 'error', txHash: null, message: '토큰 발행에 실패했습니다. 다시 시도해 주세요.' }}
      />,
    )

    await user.click(screen.getByRole('button', { name: '다시 출석하기' }))
    expect(onClaim).toHaveBeenCalledOnce()
  })
})
