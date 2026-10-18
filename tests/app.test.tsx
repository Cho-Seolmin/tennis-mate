import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ErrorBoundary } from '../src/app/ErrorBoundary.tsx'
import { appRoutes } from '../src/app/routes.tsx'
import { ResponsiveLayout } from '../src/components/layout/ResponsiveLayout.tsx'
import { Button } from '../src/components/ui/Button.tsx'
import { CourtsPage } from '../src/features/courts/CourtsPage.tsx'
import { RewardsPage } from '../src/features/rewards/RewardsPage.tsx'
import { supabaseConfigMessage } from '../src/features/auth/session.ts'
import { ToastViewport } from '../src/components/ui/ToastViewport.tsx'
import { useToastStore } from '../src/hooks/useToast.ts'

afterEach(() => {
    cleanup()
    useToastStore.setState({ toasts: [] })
    window.sessionStorage.removeItem('tennis-mate:courts:radius')
})

function renderPage(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <ResponsiveLayout />,
        children: [{ index: true, element: children }],
      },
    ],
    { initialEntries: ['/'] },
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastViewport />
    </QueryClientProvider>,
  )
}

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastViewport />
    </QueryClientProvider>,
  )
}

describe('Tennis Mate shell', () => {
  it('renders a button with its accessible name', () => {
    render(<Button>저장</Button>)

    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
  })

  it.each(['/dashboard', '/community', '/rewards', '/matches', '/ranking', '/courts'])(
    'sends unsigned visitors from %s to login',
    async (path) => {
      renderAt(path)

      expect(await screen.findByRole('heading', { level: 1, name: '로그인' })).toBeInTheDocument()
    },
  )

  it('keeps the mobile and desktop navigation in the document for CSS breakpoints', async () => {
    renderPage(<h1>대시보드</h1>)

    expect(await screen.findByRole('heading', { level: 1, name: '대시보드' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '모바일 주요 메뉴' })).toHaveClass('lg:hidden')
    expect(screen.getByRole('navigation', { name: '데스크톱 주요 메뉴' }).closest('aside')).toHaveClass(
      'hidden',
      'lg:flex',
    )
    expect(document.getElementById('main')).toHaveClass(
      'pb-[calc(4.5rem+env(safe-area-inset-bottom))]',
      'lg:pb-10',
    )
    expect(document.querySelector('main .max-w-6xl')).not.toBeNull()
  })

  it('shows demo mode and does not invent a token balance', async () => {
    render(<RewardsPage />)

    expect(await screen.findByText('Demo Mode · Sepolia')).toBeInTheDocument()
    expect(screen.getByText('잔액 없음')).toBeInTheDocument()
    expect(screen.queryByText(/^\d+(\.\d+)?$/)).not.toBeInTheDocument()
  })

  it('does not search courts or invent places without a maps key', async () => {
    window.sessionStorage.removeItem('tennis-mate:courts:radius')
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CourtsPage />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Demo Mode · Google Maps')).toBeInTheDocument()
    expect(screen.getByText('테니스장을 표시하지 않습니다')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '검색' })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '3km' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: '5km' }))
    expect(window.sessionStorage.getItem('tennis-mate:courts:radius')).toBe('5000')
  })

  it('asks for an email code and does not invent a session without Supabase', async () => {
    const user = userEvent.setup()
    renderAt('/login')

    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(screen.getByLabelText('인증 코드')).toBeInTheDocument()
    expect(screen.queryByLabelText('비밀번호')).not.toBeInTheDocument()
    expect(screen.getByText(supabaseConfigMessage, { exact: false })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '인증 코드 받기' }))
    expect(await screen.findByText('올바른 이메일을 입력해 주세요.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('이메일'), 'not-an-email')
    await user.type(screen.getByLabelText('인증 코드'), '1234567')
    await user.click(screen.getByRole('button', { name: '로그인' }))
    expect(await screen.findByText('8자리 인증 코드를 입력해 주세요.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('이메일'))
    await user.type(screen.getByLabelText('이메일'), 'player@example.com')
    await user.clear(screen.getByLabelText('인증 코드'))
    await user.type(screen.getByLabelText('인증 코드'), '12345678')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(supabaseConfigMessage)
    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument()
    expect(screen.queryByText(/0x[0-9a-fA-F]{40}/)).not.toBeInTheDocument()
  })

  it('renders the not found screen', async () => {
    renderAt('/missing')

    expect(await screen.findByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument()
  })

  it('renders the error boundary fallback', () => {
    function BrokenScreen(): ReactNode {
      throw new Error('broken screen')
    }

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <BrokenScreen />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('화면을 표시하지 못했습니다')
    consoleError.mockRestore()
  })
})
