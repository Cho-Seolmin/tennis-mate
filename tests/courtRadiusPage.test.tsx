import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CourtsPage } from '../src/features/courts/CourtsPage.tsx'
import { COURT_RADIUS_STORAGE_KEY } from '../src/features/courts/radiusStorage.ts'

afterEach(() => {
  cleanup()
  window.sessionStorage.removeItem(COURT_RADIUS_STORAGE_KEY)
})

function renderCourts() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CourtsPage />
    </QueryClientProvider>,
  )
}

describe('court radius on the page', () => {
  it('restores 5km after refresh and ignores an invalid stored value', async () => {
    const user = userEvent.setup()
    const locate = vi.fn()
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: locate },
    })
    window.sessionStorage.setItem(COURT_RADIUS_STORAGE_KEY, '5000')

    const saved = renderCourts()
    expect(screen.getByRole('radio', { name: '5km' })).toBeChecked()
    expect(locate).not.toHaveBeenCalled()
    saved.unmount()

    const restored = renderCourts()
    expect(screen.getByRole('radio', { name: '5km' })).toBeChecked()
    restored.unmount()

    window.sessionStorage.setItem(COURT_RADIUS_STORAGE_KEY, '9000')
    renderCourts()
    expect(screen.getByRole('radio', { name: '3km' })).toBeChecked()
    expect(window.sessionStorage.getItem(COURT_RADIUS_STORAGE_KEY)).toBe('3000')

    await user.click(screen.getByRole('radio', { name: '1km' }))
    expect(window.sessionStorage.getItem(COURT_RADIUS_STORAGE_KEY)).toBe('1000')
  })
})
