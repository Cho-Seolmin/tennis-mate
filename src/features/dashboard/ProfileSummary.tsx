import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Input } from '../../components/ui/Input.tsx'
import { useToast } from '../../hooks/useToast.ts'
import { updateNickname } from '../../lib/supabase.ts'
import type { Profile } from '../../types/database.ts'
import { formatFullDate, toDateKey } from './dateTime.ts'
import { ProfileAvatar } from './ProfileAvatar.tsx'
import { TokenBalanceView } from './TokenBalanceView.tsx'
import { tokenViewFromQuery } from './tokenView.ts'
import { useWalletBalances } from './useAccount.ts'

const nicknameSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, { error: '닉네임을 입력해 주세요.' })
    .max(20, { error: '닉네임은 20자까지 입력할 수 있습니다.' }),
})

type NicknameValues = z.infer<typeof nicknameSchema>

type ProfileSummaryProps = {
  profile: Profile
  email: string
  userId: string
}

export function ProfileSummary({ profile, email, userId }: ProfileSummaryProps) {
  const [today] = useState(() => new Date())
  const queryClient = useQueryClient()
  const { push } = useToast()
  const balances = useWalletBalances(profile.wallet_address)
  const form = useForm<NicknameValues>({
    resolver: zodResolver(nicknameSchema),
    values: { nickname: profile.nickname },
    resetOptions: { keepDirtyValues: true },
  })
  const nicknameMutation = useMutation({
    mutationFn: (values: NicknameValues) => updateNickname(userId, values.nickname),
    onSuccess: async (nextProfile) => {
      queryClient.setQueryData(['account', userId], nextProfile)
      form.reset({ nickname: nextProfile.nickname })
      push({ tone: 'success', message: '닉네임을 저장했습니다.' })
    },
    onError: (error) => {
      form.setError('nickname', {
        message: error instanceof Error ? error.message : '닉네임을 저장하지 못했습니다.',
      })
    },
  })

  return (
    <Card>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <ProfileAvatar name={profile.nickname} avatarUrl={profile.avatar_url} />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-ink">{profile.nickname}</h2>
              {email ? <p className="truncate text-sm text-ink/70">{email}</p> : null}
              <p className="text-sm text-ink/70">
                <time dateTime={toDateKey(today)}>{formatFullDate(today)}</time>
              </p>
            </div>
          </div>
          <form
            className="mt-4 space-y-3"
            noValidate
            onSubmit={form.handleSubmit((values) => {
              nicknameMutation.mutate(values)
            })}
          >
            <Input
              label="닉네임"
              maxLength={20}
              error={form.formState.errors.nickname?.message}
              {...form.register('nickname')}
            />
            <Button type="submit" variant="secondary" disabled={nicknameMutation.isPending}>
              {nicknameMutation.isPending ? '저장하는 중' : '닉네임 저장'}
            </Button>
          </form>
        </div>
        <TokenBalanceView
          status={tokenViewFromQuery(profile.wallet_address, balances)}
          onRetry={() => {
            void balances.refetch()
          }}
        />
      </div>
    </Card>
  )
}
