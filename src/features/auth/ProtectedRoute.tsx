import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet } from 'react-router'
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { isSupabaseConfigured } from '../../lib/env.ts'
import { getCurrentUser } from '../../lib/supabase.ts'
import { authUserQueryKey } from './session.ts'

export function ProtectedRoute() {
  const userQuery = useQuery({
    queryKey: authUserQueryKey,
    queryFn: getCurrentUser,
    enabled: isSupabaseConfigured,
  })

  if (!isSupabaseConfigured) {
    return <Navigate to="/login" replace />
  }

  if (userQuery.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface px-4">
        <Loading label="세션을 확인하고 있습니다" />
      </div>
    )
  }

  if (userQuery.isError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface px-4">
        <ErrorMessage
          title="세션을 확인하지 못했습니다"
          message="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
          onRetry={() => {
            void userQuery.refetch()
          }}
        />
      </div>
    )
  }

  if (!userQuery.data) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
