import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { ToastViewport } from '../components/ui/ToastViewport.tsx'
import { authUserQueryKey } from '../features/auth/session.ts'
import { queryClient } from '../lib/queryClient.ts'
import { supabase } from '../lib/supabase.ts'

type ProvidersProps = {
  children: ReactNode
}

function AuthSync() {
  const client = useQueryClient()

  useEffect(() => {
    if (!supabase) {
      return
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      client.setQueryData(authUserQueryKey, session?.user ?? null)
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [client])

  return null
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      {children}
      <ToastViewport />
    </QueryClientProvider>
  )
}
