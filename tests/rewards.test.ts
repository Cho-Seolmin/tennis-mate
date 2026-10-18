import { describe, expect, it } from 'vitest'
import { canClaimReward, rewardView, sepoliaTxUrl } from '../src/features/rewards/rewardState.ts'
import { seoulDate } from '../src/features/rewards/seoulDate.ts'
import migrationSql from '../supabase/migrations/20261018030000_attendance.sql?raw'
import contractSource from '../contracts/TennisToken.sol?raw'
import type { Attendance } from '../src/types/database.ts'

const tx = `0x${'ab'.repeat(32)}`

function attendance(
  status: Attendance['status'],
  txHash: string | null = tx,
  lockedUntil: string | null = '2099-01-01T00:00:00.000Z',
): Attendance {
  return {
    id: 'attendance-1',
    user_id: 'user-1',
    reward_date: '2026-10-18',
    amount: 10,
    tx_hash: txHash,
    status,
    locked_until: lockedUntil,
  }
}

describe('seoul date', () => {
  it('uses the Asia/Seoul calendar day', () => {
    expect(seoulDate(new Date('2026-10-17T14:59:00.000Z'))).toBe('2026-10-17')
    expect(seoulDate(new Date('2026-10-17T15:00:00.000Z'))).toBe('2026-10-18')
  })
})

describe('reward view', () => {
  it('maps attendance rows to the screen state and blocks a second claim', () => {
    expect(rewardView(null)).toMatchObject({ status: 'idle', txHash: null })
    expect(rewardView(attendance('pending', null)).status).toBe('pending')
    expect(rewardView(attendance('pending', null, '2000-01-01T00:00:00.000Z')).status).toBe('error')
    expect(rewardView(attendance('confirming')).status).toBe('confirming')
    expect(rewardView(attendance('completed'))).toMatchObject({
      status: 'success',
      message: '오늘 10 TNS 출석 보상을 받았습니다.',
    })
    expect(rewardView(attendance('failed')).status).toBe('error')
    expect(rewardView({ ...attendance('completed'), amount: 99 }).status).toBe('error')
    expect(canClaimReward('idle')).toBe(true)
    expect(canClaimReward('error')).toBe(true)
    expect(canClaimReward('success')).toBe(false)
    expect(canClaimReward('confirming')).toBe(false)
  })

  it('builds an etherscan link only for a transaction hash', () => {
    expect(sepoliaTxUrl(tx)).toBe(`https://sepolia.etherscan.io/tx/${tx}`)
    expect(sepoliaTxUrl('0x1234')).toBeNull()
    expect(sepoliaTxUrl(null)).toBeNull()
  })
})

describe('attendance migration and token contract', () => {
  it('pays 10 TNS once per Seoul day and keeps minting with the owner', () => {
    expect(migrationSql).toContain('constraint attendance_user_date_key unique (user_id, reward_date)')
    expect(migrationSql).toContain('constraint attendance_amount_value check (amount = 10)')
    expect(migrationSql).toContain("(timezone('Asia/Seoul', now()))::date")
    expect(migrationSql).toContain('pg_advisory_xact_lock')
    expect(migrationSql).toContain('for update')
    expect(migrationSql).toContain("raise exception 'not allowed'")
    expect(migrationSql).toContain('grant select on table public.attendance to authenticated')
    expect(migrationSql).toContain('revoke all on function public.begin_attendance_claim(uuid) from public, anon, authenticated')
    expect(contractSource).toContain('contract TennisToken is ERC20, Ownable')
    expect(contractSource).toContain('ERC20("Tennis Token", "TNS")')
    expect(contractSource).toContain('function mint(address to, uint256 amount) external onlyOwner')
  })
})
