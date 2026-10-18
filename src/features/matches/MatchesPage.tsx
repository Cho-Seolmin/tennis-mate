import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../../components/layout/PageHeader.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { DemoModeNotice } from '../../components/ui/DemoModeNotice.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { isTokenConfigured } from '../../lib/env.ts'
import { useToast } from '../../hooks/useToast.ts'
import type { Match } from '../../types/database.ts'
import { useAccount } from '../dashboard/useAccount.ts'
import { sepoliaTxUrl } from '../rewards/rewardState.ts'
import { refreshRanking, rankingQueryKey } from '../ranking/rankingApi.ts'
import { MatchForm } from './MatchForm.tsx'
import {
  fetchMatches,
  fetchOpponents,
  matchesQueryKey,
  opponentsQueryKey,
  settleMatch,
} from './matchApi.ts'
import { transferPhase, transferRequestSchema } from './transferSchema.ts'

const statusLabel: Record<Match['status'], string> = {
  pending: '처리 중',
  confirming: '블록 확인 중',
  completed: '성공',
  failed: '실패',
}

export function MatchesPage() {
  if (!isTokenConfigured) {
    return (
      <section className="space-y-6">
        <PageHeader
          title="경기"
          description="패자가 승자에게 TNS를 보내는 경기 결과 화면입니다. 계약 주소가 없으면 전송하지 않습니다."
        />
        <DemoModeNotice
          service="Sepolia"
          detail="토큰 계약 주소가 없어 경기 토큰 전송을 실행하지 않습니다. 상대방 동의 확인도 이 화면의 범위가 아닙니다."
        />
        <Card>
          <EmptyState
            title="전송할 경기가 없습니다"
            description="계약이 연결되기 전에는 수량이나 전송 결과를 만들지 않습니다."
          />
        </Card>
      </section>
    )
  }

  return <ConfiguredMatches />
}

function ConfiguredMatches() {
  const { push } = useToast()
  const queryClient = useQueryClient()
  const { userId, userQuery, profile, accountQuery } = useAccount()
  const opponentsQuery = useQuery({
    queryKey: opponentsQueryKey(userId ?? 'none'),
    queryFn: fetchOpponents,
    enabled: Boolean(userId),
  })
  const matchesQuery = useQuery({
    queryKey: matchesQueryKey(userId ?? 'none'),
    queryFn: () => {
      if (!userId) {
        throw new Error('로그인이 필요합니다.')
      }

      return fetchMatches(userId)
    },
    enabled: Boolean(userId),
  })
  const transfer = useMutation({
    mutationFn: settleMatch,
    onSuccess: async (result) => {
      if (result.status === 'success') {
        try {
          await refreshRanking()
          await queryClient.invalidateQueries({ queryKey: rankingQueryKey })
        } catch (error) {
          push({
            tone: 'error',
            message: error instanceof Error ? error.message : '랭킹을 갱신하지 못했습니다.',
          })
        }

        await queryClient.invalidateQueries({ queryKey: ['wallet-balances'] })
      }

      if (userId) {
        await queryClient.invalidateQueries({ queryKey: matchesQueryKey(userId) })
      }
    },
  })
  const phase = transferPhase(transfer.isPending, transfer.data?.status ?? null)
  const feedback = transfer.data

  if (userQuery.isPending || (userId && (opponentsQuery.isPending || matchesQuery.isPending))) {
    return <Loading label="경기를 불러오는 중" />
  }

  if (userQuery.isError || !userId || opponentsQuery.isError || matchesQuery.isError) {
    return (
      <ErrorMessage
        title="경기를 불러오지 못했습니다"
        message="로그인과 상대 목록을 확인한 뒤 다시 시도해 주세요."
        onRetry={() => {
          void userQuery.refetch()
          void accountQuery.refetch()
          void opponentsQuery.refetch()
          void matchesQuery.refetch()
        }}
      />
    )
  }

  const opponents = opponentsQuery.data ?? []
  const matches = matchesQuery.data ?? []

  return (
    <section className="space-y-6">
      <PageHeader
        title="경기"
        description="패자 지갑에서 승자 지갑으로 TNS를 보냅니다. 상대방이 경기 결과에 동의했는지는 확인하지 않습니다."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold text-ink">경기 결과</h2>
          <div className="mt-4">
            {opponents.length === 0 ? (
              <EmptyState
                title="보낼 상대가 없습니다"
                description="지갑이 있는 다른 사용자가 등록되면 선택할 수 있습니다."
              />
            ) : (
              <MatchForm
                userId={userId}
                opponents={opponents}
                phase={phase}
                message={feedback?.message ?? null}
                txHash={feedback?.txHash ?? null}
                needsEth={feedback?.needsEth ?? false}
                onTransfer={(request) => {
                  transfer.mutate(request)
                }}
              />
            )}
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-ink">내 경기</h2>
          <div className="mt-4 space-y-3">
            {matches.length === 0 ? (
              <EmptyState title="등록된 경기가 없습니다" description="결과를 보내면 전송 상태가 여기에 남습니다." />
            ) : (
              matches.map((match) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  winner={playerName(match.winner_id, userId, profile?.nickname, opponents)}
                  loser={playerName(match.loser_id, userId, profile?.nickname, opponents)}
                  canRetry={match.loser_id === userId && (match.status === 'pending' || match.status === 'confirming' || match.status === 'failed')}
                  pending={transfer.isPending}
                  onRetry={() => {
                    const request = requestFromMatch(match)

                    if (request) {
                      transfer.mutate(request)
                    }
                  }}
                />
              ))
            )}
          </div>
        </Card>
      </div>
    </section>
  )
}

function MatchRow({
  match,
  winner,
  loser,
  canRetry,
  pending,
  onRetry,
}: {
  match: Match
  winner: string
  loser: string
  canRetry: boolean
  pending: boolean
  onRetry: () => void
}) {
  const txUrl = sepoliaTxUrl(match.tx_hash)
  const when = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(match.played_at))

  return (
    <article className="rounded-2xl border border-line px-4 py-3">
      <p className="text-sm font-semibold text-ink">
        {winner} 승 · {loser} 패
      </p>
      <p className="mt-1 text-sm text-ink/70">
        {when} · {normalizeAmount(match.amount)} TNS · {statusLabel[match.status]}
      </p>
      {txUrl ? (
        <a className="mt-2 inline-block text-sm font-semibold text-court-800 underline" href={txUrl}>
          Etherscan
        </a>
      ) : null}
      {canRetry ? (
        <Button className="mt-3" variant="secondary" disabled={pending} onClick={onRetry}>
          전송 상태 확인
        </Button>
      ) : null}
    </article>
  )
}

function playerName(
  id: string,
  userId: string,
  nickname: string | undefined,
  opponents: { id: string; nickname: string }[],
) {
  if (id === userId) {
    return nickname ?? '나'
  }

  return opponents.find((opponent) => opponent.id === id)?.nickname ?? '사용자'
}

function requestFromMatch(match: Match) {
  const parsed = transferRequestSchema.safeParse({
    matchId: match.id,
    winnerId: match.winner_id,
    loserId: match.loser_id,
    amount: normalizeAmount(match.amount),
    playedAt: match.played_at,
  })

  return parsed.success ? parsed.data : null
}

function normalizeAmount(amount: string) {
  const [whole, fraction = ''] = amount.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}
