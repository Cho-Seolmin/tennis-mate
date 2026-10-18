import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { EquipmentSection } from '../src/features/dashboard/EquipmentSection.tsx'

afterEach(() => {
  cleanup()
})

describe('equipment form', () => {
  it('shows a field error and does not save an empty brand', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EquipmentSection userId="user-1" />
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: '장비 등록' }))

    expect(await screen.findByText('브랜드를 입력해 주세요.')).toBeInTheDocument()
    expect(screen.getByText('모델을 입력해 주세요.')).toBeInTheDocument()
    expect(screen.queryByText('장비를 등록했습니다.')).not.toBeInTheDocument()
  })
})
