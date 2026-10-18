import { Button } from '../../components/ui/Button.tsx'
import { canClaimReward, sepoliaTxUrl, type RewardView } from './rewardState.ts'

type AttendanceCardProps = {
  view: RewardView
  submitting: boolean
  onClaim: () => void
}

const buttonLabel: Record<RewardView['status'], string> = {
  idle: '출석하고 10 TNS 받기',
  pending: '출석을 기록하는 중',
  confirming: '트랜잭션을 확인하는 중',
  success: '오늘 출석 완료',
  error: '다시 출석하기',
}

export function AttendanceCard({ view, submitting, onClaim }: AttendanceCardProps) {
  const txUrl = sepoliaTxUrl(view.txHash)
  const disabled = submitting || !canClaimReward(view.status)

  return (
    <div className="space-y-4">
      <p role="status" className="text-sm leading-6 text-ink/75">
        {view.status === 'idle' ? '오늘은 아직 출석하지 않았습니다.' : view.message}
      </p>
      <Button className="w-full" disabled={disabled} onClick={onClaim}>
        {submitting && view.status !== 'confirming' ? '출석을 기록하는 중' : buttonLabel[view.status]}
      </Button>
      {txUrl ? (
        <a
          className="inline-flex text-sm font-semibold text-court-800 underline-offset-4 hover:underline"
          href={txUrl}
          target="_blank"
          rel="noreferrer"
        >
          Sepolia Etherscan에서 보기
        </a>
      ) : null}
      <p className="text-sm leading-6 text-ink/65">
        출석 보상은 관리자 지갑이 가스비를 냅니다. 토큰을 받기만 할 때는 본인 지갑의 ETH가 필요 없습니다.
        이후 직접 토큰을 보낼 때는 Sepolia ETH가 필요합니다.
      </p>
    </div>
  )
}
