import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { Brand } from '../../components/layout/Brand.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Input } from '../../components/ui/Input.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { useToast } from '../../hooks/useToast.ts'
import { isSupabaseConfigured } from '../../lib/env.ts'
import { getCurrentUser, sendEmailCode, verifyEmailCode } from '../../lib/supabase.ts'
import { authUserQueryKey, supabaseConfigMessage } from './session.ts'

const emailSchema = z.email({ error: '올바른 이메일을 입력해 주세요.' })

const loginSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{8}$/, { error: '8자리 인증 코드를 입력해 주세요.' }),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { push } = useToast()
  const [sending, setSending] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const userQuery = useQuery({
    queryKey: authUserQueryKey,
    queryFn: getCurrentUser,
    enabled: isSupabaseConfigured,
  })
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      code: '',
    },
  })

  if (isSupabaseConfigured && userQuery.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface px-4">
        <Loading label="세션을 확인하고 있습니다" />
      </div>
    )
  }

  if (userQuery.data) {
    return <Navigate to="/dashboard" replace />
  }

  async function sendCode() {
    const parsed = emailSchema.safeParse(form.getValues('email'))

    if (!parsed.success) {
      form.setError('email', { message: '올바른 이메일을 입력해 주세요.' })
      return
    }

    form.clearErrors('email')

    if (!isSupabaseConfigured) {
      form.setError('root', { message: supabaseConfigMessage })
      return
    }

    setSending(true)
    form.clearErrors('root')

    try {
      await sendEmailCode(parsed.data)
      setCodeSent(true)
      push({ tone: 'success', message: '인증 코드를 이메일로 보냈습니다.' })
    } catch (error) {
      form.setError('root', { message: toAuthMessage(error) })
    } finally {
      setSending(false)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!isSupabaseConfigured) {
      form.setError('root', { message: supabaseConfigMessage })
      return
    }

    if (!codeSent) {
      form.setError('root', { message: '먼저 인증 코드를 받아 주세요.' })
      return
    }

    try {
      await verifyEmailCode(values.email, values.code)
      const user = await getCurrentUser()

      if (!user) {
        form.setError('root', { message: '세션을 저장하지 못했습니다.' })
        return
      }

      queryClient.setQueryData(authUserQueryKey, user)
      await navigate('/dashboard', { replace: true })
    } catch (error) {
      form.setError('root', { message: toAuthMessage(error) })
    }
  })

  const rootError = form.formState.errors.root?.message

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-court-800 px-10 py-12 text-white lg:flex">
        <Brand tone="inverse" />
        <div className="max-w-lg">
          <p className="font-display text-4xl font-semibold leading-tight xl:text-5xl">
            코트 위의 하루를
            <br />
            정리합니다
          </p>
          <p className="mt-4 text-base leading-7 text-court-100">
            이메일로 받은 인증 코드로 들어오면 프로필과 Sepolia 지갑이 준비됩니다.
          </p>
        </div>
        <p className="text-sm text-court-100">개인키는 브라우저로 전달하지 않습니다.</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 md:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">로그인</h1>
          <p className="mt-2 text-sm leading-6 text-ink/70 md:text-base">
            이메일로 인증 코드를 받은 뒤 로그인합니다. 처음 로그인하면 계정이 만들어집니다.
          </p>

          {!isSupabaseConfigured ? (
            <p
              role="status"
              className="mt-6 rounded-2xl border border-court-200 bg-court-50 px-4 py-3 text-sm leading-6 text-court-900"
            >
              {supabaseConfigMessage} env 파일에 값을 넣고 개발 서버를 다시 시작해 주세요.
            </p>
          ) : null}

          <form className="mt-8 space-y-4" noValidate onSubmit={onSubmit}>
            <Input
              label="이메일"
              type="email"
              autoComplete="email"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
            <Input
              label="인증 코드"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              hint="메일로 받은 8자리 코드를 입력합니다."
              error={form.formState.errors.code?.message}
              {...form.register('code')}
            />
            {rootError ? (
              <p role="alert" className="text-sm leading-6 text-danger">
                {rootError}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={sending || form.formState.isSubmitting}
                onClick={() => {
                  void sendCode()
                }}
              >
                {sending ? '코드를 보내는 중' : '인증 코드 받기'}
              </Button>
              <Button
                type="submit"
                className="w-full"
                disabled={sending || form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? '로그인하는 중' : '로그인'}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}

function toAuthMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : '로그인에 실패했습니다.'
  const message = raw.toLowerCase()

  if (message.includes('expired') || message.includes('invalid') || message.includes('otp')) {
    return '인증 코드가 올바르지 않거나 만료되었습니다.'
  }

  if (message.includes('rate') || message.includes('too many')) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  }

  if (message.includes('network') || message.includes('fetch')) {
    return '네트워크 상태를 확인한 뒤 다시 시도해 주세요.'
  }

  if (raw.length > 180) {
    return '로그인에 실패했습니다.'
  }

  return raw
}
