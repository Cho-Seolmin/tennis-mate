import { tnsToWei } from './tns.ts'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type TransferRequest = {
  matchId: string
  winnerId: string
  loserId: string
  amount: string
  playedAt: string
}

export function parseTransferRequest(value: unknown): TransferRequest | null {
  if (!isRecord(value)) {
    return null
  }

  const matchId = readUuid(value.matchId)
  const winnerId = readUuid(value.winnerId)
  const loserId = readUuid(value.loserId)
  const amount = typeof value.amount === 'string' ? value.amount.trim() : null
  const playedAt = typeof value.playedAt === 'string' ? value.playedAt : null

  if (!matchId || !winnerId || !loserId || !amount || !playedAt || winnerId === loserId) {
    return null
  }

  if (!isTransferTimestamp(playedAt) || tnsToWei(amount) === null) {
    return null
  }

  return { matchId, winnerId, loserId, amount, playedAt }
}

function readUuid(value: unknown) {
  return typeof value === 'string' && uuidPattern.test(value) ? value : null
}

export function isTransferTimestamp(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
