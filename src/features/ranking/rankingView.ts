import { formatTnsFromWei } from '../../../supabase/functions/_shared/tns.ts'
import type { RankingEntry } from '../../types/database.ts'

export { compareRanking, rankPlayers, sliceRankingPage, RANKING_PAGE_SIZE } from '../../../supabase/functions/_shared/ranking.ts'

export function formatRankingBalance(balanceWei: string) {
  if (!/^\d+$/.test(balanceWei)) {
    return null
  }

  return formatTnsFromWei(BigInt(balanceWei))
}

export function dedupedRankingEntries(pages: RankingEntry[][]) {
  const seen = new Set<string>()
  const merged: RankingEntry[] = []

  for (const page of pages) {
    for (const entry of page) {
      if (seen.has(entry.userId)) {
        continue
      }

      seen.add(entry.userId)
      merged.push(entry)
    }
  }

  return merged.sort((left, right) => left.rank - right.rank)
}
