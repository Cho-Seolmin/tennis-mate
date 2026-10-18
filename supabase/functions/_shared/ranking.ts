export const RANKING_PAGE_SIZE = 20

export type RankedPlayer = {
  id: string
  nickname: string
  balance: bigint
}

export function compareRanking(left: RankedPlayer, right: RankedPlayer) {
  if (left.balance !== right.balance) {
    return left.balance > right.balance ? -1 : 1
  }

  const nickname = left.nickname.localeCompare(right.nickname, 'ko')

  if (nickname !== 0) {
    return nickname
  }

  if (left.id === right.id) {
    return 0
  }

  return left.id < right.id ? -1 : 1
}

export function rankPlayers(players: RankedPlayer[]) {
  const unique = new Map<string, RankedPlayer>()

  for (const player of players) {
    if (!unique.has(player.id)) {
      unique.set(player.id, player)
    }
  }

  return [...unique.values()].sort(compareRanking).map((player, index) => ({
    ...player,
    rank: index + 1,
  }))
}

export function sliceRankingPage<T extends { rank: number; id: string }>(
  players: T[],
  afterRank: number,
) {
  const unique = new Map<string, T>()

  for (const player of players) {
    if (!unique.has(player.id)) {
      unique.set(player.id, player)
    }
  }

  const ordered = [...unique.values()].sort((left, right) => left.rank - right.rank)
  const page = ordered.filter((player) => player.rank > afterRank).slice(0, RANKING_PAGE_SIZE + 1)
  const hasMore = page.length > RANKING_PAGE_SIZE
  const entries = hasMore ? page.slice(0, RANKING_PAGE_SIZE) : page

  return {
    entries,
    hasMore,
    nextRank: entries.at(-1)?.rank ?? null,
  }
}
