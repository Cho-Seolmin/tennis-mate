import { buttonClass } from '../../components/ui/buttonStyles.ts'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { useToast } from '../../hooks/useToast.ts'
import { formatDisplayAmount, type TokenBalance } from './balanceApi.ts'
import { sepoliaFaucetUrl } from './faucet.ts'
import { useWalletBalances } from './useAccount.ts'

type WalletPanelProps = {
  address: string | null
}

export function WalletPanel({ address }: WalletPanelProps) {
  const { push } = useToast()
  const balances = useWalletBalances(address)

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">내 지갑</h2>
      <p className="mt-1 text-sm text-ink/70">Sepolia 테스트 네트워크</p>
      {address ? (
        <>
          <p className="mt-4 break-all font-mono text-sm leading-6 text-court-900">{address}</p>
          <Button
            className="mt-4"
            onClick={() => {
              void copyAddress(address, push)
            }}
          >
            주소 복사
          </Button>
          <div className="mt-5 space-y-4">
            {balances.isPending ? <Loading label="잔액을 확인하는 중" /> : null}
            {balances.isError ? (
              <ErrorMessage
                title="잔액을 읽지 못했습니다"
                message={
                  balances.error instanceof Error
                    ? balances.error.message
                    : 'Sepolia ETH 잔액을 읽지 못했습니다.'
                }
                onRetry={() => {
                  void balances.refetch()
                }}
              />
            ) : null}
            {balances.data ? (
              <>
                <BalanceLine label="Sepolia ETH" amount={`${formatDisplayAmount(balances.data.eth)} ETH`} />
                <TokenLine token={balances.data.token} />
              </>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm leading-6 text-ink/75">지갑 주소가 아직 없습니다.</p>
      )}
      <a
        href={sepoliaFaucetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass('secondary', 'mt-5')}
      >
        Sepolia ETH 받기
      </a>
      <p className="mt-2 text-xs leading-5 text-ink/60">
        Google Cloud Sepolia Faucet가 새 창에서 열립니다.
      </p>
    </Card>
  )
}

function BalanceLine({ label, amount }: { label: string; amount: string }) {
  return (
    <div>
      <p className="text-sm text-ink/70">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{amount}</p>
    </div>
  )
}

function TokenLine({ token }: { token: TokenBalance }) {
  if (token.status === 'disconnected') {
    return (
      <div>
        <p className="text-sm text-ink/70">TNS</p>
        <p className="mt-1 text-lg font-semibold text-ink">미연결</p>
        <p className="mt-1 text-sm leading-6 text-ink/70">
          계약 주소가 설정되면 잔액이 표시됩니다.
        </p>
      </div>
    )
  }

  if (token.status === 'error') {
    return <p className="text-sm leading-6 text-danger">{token.message}</p>
  }

  return (
    <BalanceLine label={token.symbol} amount={formatDisplayAmount(token.amount)} />
  )
}

async function copyAddress(
  address: string,
  push: (toast: { tone: 'success' | 'error'; message: string }) => void,
) {
  try {
    await navigator.clipboard.writeText(address)
    push({ tone: 'success', message: '지갑 주소를 복사했습니다.' })
  } catch {
    push({ tone: 'error', message: '주소를 복사하지 못했습니다.' })
  }
}
