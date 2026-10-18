import { zodResolver } from '@hookform/resolvers/zod'
import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../components/ui/Button.tsx'
import { Input } from '../../components/ui/Input.tsx'
import { localDateTimeToIso, toLocalInputValue } from '../dashboard/dateTime.ts'
import { sepoliaFaucetUrl } from '../dashboard/faucet.ts'
import { sepoliaTxUrl } from '../rewards/rewardState.ts'
import {
  matchFormSchema,
  transferFromForm,
  transferPhaseLabel,
  type MatchFormValues,
  type TransferPhase,
} from './transferSchema.ts'
import type { TransferRequest } from './transferSchema.ts'

type Opponent = {
  id: string
  nickname: string
}

type MatchFormProps = {
  userId: string
  opponents: Opponent[]
  phase: TransferPhase
  message: string | null
  txHash: string | null
  needsEth: boolean
  onTransfer: (request: TransferRequest) => void
}

export function MatchForm({
  userId,
  opponents,
  phase,
  message,
  txHash,
  needsEth,
  onTransfer,
}: MatchFormProps) {
  const requestId = useRef(crypto.randomUUID())
  const form = useForm<MatchFormValues>({
    resolver: zodResolver(matchFormSchema),
    defaultValues: {
      opponentId: '',
      result: 'opponent_won',
      playedAt: toLocalInputValue(new Date()),
      amount: '5',
    },
  })
  const opponentId = form.watch('opponentId')
  const result = form.watch('result')
  const opponent = opponents.find((item) => item.id === opponentId)
  const winnerName = result === 'opponent_won' ? (opponent?.nickname ?? '상대') : '나'
  const loserName = result === 'opponent_won' ? '나' : (opponent?.nickname ?? '상대')
  const txUrl = sepoliaTxUrl(txHash)
  const pending = phase === 'requesting'
  const submitLabel = pending ? '전송 요청' : '토큰 보내기'

  function submit(values: MatchFormValues) {
    if (phase === 'success') {
      requestId.current = crypto.randomUUID()
    }

    const parsed = transferFromForm(values, userId, requestId.current, localDateTimeToIso(values.playedAt))

    if (!parsed.success) {
      form.setError('amount', { message: parsed.error.issues[0]?.message ?? '전송 요청이 올바르지 않습니다.' })
      return
    }

    onTransfer(parsed.data)
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(submit)} noValidate>
      <p className="text-sm leading-6 text-ink/70">
        상대방의 경기 결과 동의는 확인하지 않습니다. 패자로 로그인한 계정만 자신의 지갑에서 토큰을 보냅니다.
      </p>
      <div className="min-w-0 space-y-2">
        <label htmlFor="match-opponent" className="block text-sm font-medium text-ink">
          상대 사용자
        </label>
        <select
          id="match-opponent"
          className={[
            'min-h-11 w-full rounded-xl border bg-white px-3 text-base text-ink',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700',
            form.formState.errors.opponentId ? 'border-danger' : 'border-line',
          ].join(' ')}
          aria-invalid={form.formState.errors.opponentId ? true : undefined}
          {...form.register('opponentId')}
        >
          <option value="">선택</option>
          {opponents.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nickname}
            </option>
          ))}
        </select>
        {form.formState.errors.opponentId ? (
          <p className="text-sm text-danger" role="alert">
            {form.formState.errors.opponentId.message}
          </p>
        ) : null}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">승자</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="radio" value="opponent_won" {...form.register('result')} />
          상대가 이겼습니다
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="radio" value="i_won" {...form.register('result')} />
          내가 이겼습니다
        </label>
        {form.formState.errors.result ? (
          <p className="text-sm text-danger" role="alert">
            {form.formState.errors.result.message}
          </p>
        ) : null}
      </fieldset>
      <p className="text-sm text-ink/70">
        승자 {winnerName} · 패자 {loserName}
      </p>
      <Input
        label="경기 날짜"
        type="datetime-local"
        error={form.formState.errors.playedAt?.message}
        {...form.register('playedAt')}
      />
      <Input
        label="전송 토큰 수량"
        inputMode="decimal"
        hint="기본 5 TNS, 최대 100 TNS"
        error={form.formState.errors.amount?.message}
        {...form.register('amount')}
      />
      <p className="text-sm text-ink/70" role="status">
        상태: {transferPhaseLabel[phase]}
      </p>
      {message ? (
        <p className={phase === 'error' ? 'text-sm text-danger' : 'text-sm text-court-800'} role={phase === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      ) : null}
      {needsEth ? (
        <a className="text-sm font-semibold text-court-800 underline" href={sepoliaFaucetUrl}>
          Sepolia ETH Faucet 열기
        </a>
      ) : null}
      {txUrl ? (
        <a className="block text-sm font-semibold text-court-800 underline" href={txUrl}>
          Sepolia Etherscan에서 트랜잭션 보기
        </a>
      ) : null}
      <Button type="submit" disabled={pending || opponents.length === 0}>
        {phase === 'success' && !pending ? '다른 경기 토큰 보내기' : submitLabel}
      </Button>
    </form>
  )
}
