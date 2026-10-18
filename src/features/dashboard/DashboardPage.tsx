import { PageHeader } from '../../components/layout/PageHeader.tsx'
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { isSupabaseConfigured } from '../../lib/env.ts'
import { EquipmentSection } from './EquipmentSection.tsx'
import { ProfileSummary } from './ProfileSummary.tsx'
import { ScheduleSection } from './ScheduleSection.tsx'
import { useAccount } from './useAccount.ts'
import { WalletPanel } from './WalletPanel.tsx'

export function DashboardPage() {
  const { userQuery, accountQuery, userId, profile, email } = useAccount()

  if (!isSupabaseConfigured) {
    return (
      <ErrorMessage
        title="계정을 불러올 수 없습니다"
        message="Supabase URL과 anon key가 설정되지 않았습니다."
      />
    )
  }

  if (userQuery.isPending) {
    return <Loading label="계정과 지갑을 확인하고 있습니다" />
  }

  if (!userQuery.data || !userId) {
    return (
      <ErrorMessage
        title="로그인이 필요합니다"
        message="다시 로그인한 뒤 대시보드를 확인해 주세요."
      />
    )
  }

  if (accountQuery.isPending) {
    return <Loading label="계정과 지갑을 확인하고 있습니다" />
  }

  if (accountQuery.isError || !profile) {
    return (
      <ErrorMessage
        title="계정 정보를 불러오지 못했습니다"
        message={
          accountQuery.error instanceof Error ? accountQuery.error.message : '다시 시도해 주세요.'
        }
        onRetry={() => {
          void accountQuery.refetch()
        }}
      />
    )
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="대시보드"
        description="오늘 일정과 장비, Sepolia 지갑을 확인합니다."
      />
      <ProfileSummary profile={profile} email={email} userId={userId} />
      <ScheduleSection userId={userId} />
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <EquipmentSection userId={userId} />
        <WalletPanel address={profile.wallet_address} />
      </div>
    </section>
  )
}
