import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import type { TokenView } from './tokenView.ts'

type TokenBalanceViewProps = {
  status: TokenView
  onRetry?: () => void
}

export function TokenBalanceView({ status, onRetry }: TokenBalanceViewProps) {
  return (
    <section className="rounded-2xl border border-line bg-court-50 p-4" aria-label="테니스 토큰 잔액">
      <h2 className="text-sm font-semibold text-ink">테니스 토큰</h2>
      <div className="mt-3">
        {status.kind === 'loading' ? <Loading label="토큰 잔액을 확인하는 중" /> : null}
        {status.kind === 'missing-wallet' ? (
          <p className="text-sm leading-6 text-ink/75">지갑 주소를 만든 뒤 잔액을 확인합니다.</p>
        ) : null}
        {status.kind === 'disconnected' ? (
          <>
            <p className="font-display text-3xl font-semibold text-ink">미연결</p>
            <p className="mt-2 text-sm leading-6 text-ink/75">
              TNS 계약 주소가 설정되기 전에는 잔액을 표시하지 않습니다.
            </p>
          </>
        ) : null}
        {status.kind === 'ready' ? (
          <>
            <p className="font-display text-3xl font-semibold text-ink">
              {status.amount} {status.symbol}
            </p>
            <p className="mt-2 text-sm leading-6 text-ink/75">Sepolia 테스트 토큰 잔액입니다.</p>
          </>
        ) : null}
        {status.kind === 'error' ? (
          <ErrorMessage title="잔액을 읽지 못했습니다" message={status.message} onRetry={onRetry} />
        ) : null}
      </div>
    </section>
  )
}
