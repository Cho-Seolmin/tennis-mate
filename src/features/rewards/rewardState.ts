import type { Attendance, AttendanceStatus } from '../../types/database.ts'

export const rewardUiStatuses = ['idle', 'pending', 'confirming', 'success', 'error'] as const

export type RewardUiStatus = (typeof rewardUiStatuses)[number]

export type RewardView = {
  status: RewardUiStatus
  txHash: string | null
  message: string | null
}

const rewardMessages: Record<AttendanceStatus, string> = {
  pending: '출석 보상을 요청했습니다.',
  confirming: 'Sepolia 트랜잭션을 확인하고 있습니다.',
  completed: '오늘 10 TNS 출석 보상을 받았습니다.',
  failed: '토큰 발행에 실패했습니다. 다시 시도해 주세요.',
}

export function rewardView(attendance: Attendance | null): RewardView {
  if (!attendance) {
    return { status: 'idle', txHash: null, message: null }
  }

  if (!isRewardAmount(attendance.amount)) {
    return {
      status: 'error',
      txHash: validTxHash(attendance.tx_hash),
      message: '출석 보상 수량이 서버 규칙과 다릅니다.',
    }
  }

  const txHash = validTxHash(attendance.tx_hash)

  if (attendance.status === 'completed') {
    return {
      status: txHash ? 'success' : 'error',
      txHash,
      message: txHash ? rewardMessages.completed : '지급 트랜잭션을 확인하지 못했습니다.',
    }
  }

  if (attendance.status === 'failed') {
    return { status: 'error', txHash, message: rewardMessages.failed }
  }

  if (attendance.status === 'confirming' || txHash) {
    return { status: 'confirming', txHash, message: rewardMessages.confirming }
  }

  if (isLockActive(attendance.locked_until)) {
    return { status: 'pending', txHash: null, message: rewardMessages.pending }
  }

  return {
    status: 'error',
    txHash: null,
    message: '출석 보상을 끝내지 못했습니다. 다시 시도해 주세요.',
  }
}

export function canClaimReward(status: RewardUiStatus) {
  return status === 'idle' || status === 'error'
}

export function sepoliaTxUrl(txHash: string | null) {
  if (!validTxHash(txHash)) {
    return null
  }

  return `https://sepolia.etherscan.io/tx/${txHash}`
}

export function isRewardAmount(amount: number | string) {
  return Number(amount) === 10
}

function validTxHash(txHash: string | null) {
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return null
  }

  return txHash
}

function isLockActive(lockedUntil: string | null) {
  if (!lockedUntil) {
    return false
  }

  const time = new Date(lockedUntil).getTime()
  return Number.isFinite(time) && time > Date.now()
}
