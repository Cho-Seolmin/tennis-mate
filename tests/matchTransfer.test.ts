import { describe, expect, it } from 'vitest'
import migrationSql from '../supabase/migrations/20261018040000_matches_and_ranking.sql?raw'
import settleSource from '../supabase/functions/settle-match/index.ts?raw'
import { parseTransferRequest } from '../supabase/functions/_shared/transfer.ts'
import { tnsToWei } from '../supabase/functions/_shared/tns.ts'
import { transferRequestSchema } from '../src/features/matches/transferSchema.ts'

const winnerId = '22222222-2222-4222-8222-222222222222'
const loserId = '11111111-1111-4111-8111-111111111111'
const matchId = '33333333-3333-4333-8333-333333333333'
const playedAt = '2026-10-18T01:00:00.000Z'

const valid = {
  matchId,
  winnerId,
  loserId,
  amount: '5',
  playedAt,
}

describe('token transfer dto', () => {
  it('converts a validated amount to wei without using a floating-point number', () => {
    expect(tnsToWei('5')).toBe(5n * 10n ** 18n)
    expect(tnsToWei('100')).toBe(100n * 10n ** 18n)
    expect(tnsToWei('0.5')).toBe(5n * 10n ** 17n)
    expect(transferRequestSchema.parse(valid).amount).toBe('5')
  })

  it.each(['0', '0.0', '-1', '101', '100.000001', '5.1234567', ''])('rejects amount %s', (amount) => {
    expect(tnsToWei(amount)).toBeNull()
    expect(transferRequestSchema.safeParse({ ...valid, amount }).success).toBe(false)
    expect(parseTransferRequest({ ...valid, amount })).toBeNull()
  })

  it('rejects the same winner and loser on the client and server', () => {
    const same = { ...valid, loserId: winnerId }

    expect(transferRequestSchema.safeParse(same).success).toBe(false)
    expect(parseTransferRequest(same)).toBeNull()
  })

  it('does not accept a wallet address from the request body', () => {
    const parsed = parseTransferRequest({ ...valid, walletAddress: '0x0000000000000000000000000000000000000001' })

    expect(parsed).toEqual(valid)
    expect(parsed && 'walletAddress' in parsed).toBe(false)
  })

  it('keeps the transfer inside the loser-owned match row', () => {
    const source = settleSource

    expect(source).toContain('userData.user.id !== transfer.loserId')
    expect(source).toContain('begun.winner_wallet')
    expect(source).toContain("functionName: 'transfer'")
    expect(source).not.toContain('body.wallet')
    expect(migrationSql).toContain('winner_id <> loser_id')
    expect(migrationSql).toContain('amount > 0 and amount <= 100')
    expect(migrationSql).toContain("auth.role() is distinct from 'service_role'")
  })
})
