import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { authUserQueryKey } from '../../features/auth/session.ts'
import { useToast } from '../../hooks/useToast.ts'
import { getDemoNotices, isSupabaseConfigured } from '../../lib/env.ts'
import { getCurrentUser, signOut } from '../../lib/supabase.ts'
import { Brand } from './Brand.tsx'
import { PageContainer } from './PageContainer.tsx'
import { Button } from '../ui/Button.tsx'

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
      <PageContainer className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
        <Link
          to="/dashboard"
          className="min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700 lg:hidden"
        >
          <Brand />
        </Link>
        <p className="hidden text-sm text-ink/70 lg:block">일정, 모임, 보상을 한곳에서</p>
        <div className="flex shrink-0 items-center gap-2">
          <DemoBadge />
          <LogoutButton />
        </div>
      </PageContainer>
    </header>
  )
}

function LogoutButton() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { push } = useToast()
  const userQuery = useQuery({
    queryKey: authUserQueryKey,
    queryFn: getCurrentUser,
    enabled: isSupabaseConfigured,
  })
  const logout = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      queryClient.clear()
      await navigate('/login', { replace: true })
    },
    onError: () => {
      push({ tone: 'error', message: '로그아웃하지 못했습니다.' })
    },
  })

  if (!userQuery.data) {
    return null
  }

  return (
    <Button
      variant="ghost"
      className="px-3"
      disabled={logout.isPending}
      onClick={() => {
        logout.mutate()
      }}
    >
      {logout.isPending ? '로그아웃 중' : '로그아웃'}
    </Button>
  )
}

function DemoBadge() {
  const notices = getDemoNotices()

  if (notices.length === 0) {
    return null
  }

  return (
    <span className="shrink-0 rounded-full bg-ball px-3 py-1 text-xs font-semibold text-court-900">
      Demo Mode
    </span>
  )
}
