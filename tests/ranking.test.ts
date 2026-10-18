import { describe, expect, it } from 'vitest'
import migrationSql from '../supabase/migrations/20261018040000_matches_and_ranking.sql?raw'
import refreshSource from '../supabase/functions/refresh-ranking/index.ts?raw'
import { rankPlayers, sliceRankingPage } from '../supabase/functions/_shared/ranking.ts'
import { dedupedRankingEntries, formatRankingBalance } from '../src/features/ranking/rankingView.ts'
import type { RankingEntry } from '../src/types/database.ts'

describe('ranking order', () => {
  it('sorts by balance, then nickname, then id', () => {
    const ranked = rankPlayers([
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', nickname: '가나', balance: 10n },
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', nickname: '가나', balance: 10n },
      { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', nickname: '다라', balance: 10n },
      { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', nickname: '다라', balance: 11n },
    ])

    expect(ranked.map((player) => player.id[0])).toEqual(['d', 'a', 'b', 'c'])
    expect(ranked.map((player) => player.rank)).toEqual([1, 2, 3, 4])
  })

  it('pages 20 rows and stops after the last page', () => {
    const players = Array.from({ length: 45 }, (_, index) => ({
      id: `user-${index}`,
      rank: index + 1,
    }))
    const first = sliceRankingPage(players, 0)
    const second = sliceRankingPage(players, 20)
    const last = sliceRankingPage(players, 40)

    expect(first.entries).toHaveLength(20)
    expect(first.hasMore).toBe(true)
    expect(second.entries.map((player) => player.rank)).toEqual(Array.from({ length: 20 }, (_, index) => index + 21))
    expect(second.hasMore).toBe(true)
    expect(last.entries).toHaveLength(5)
    expect(last.hasMore).toBe(false)
    expect(sliceRankingPage(players, 45).entries).toHaveLength(0)
  })

  it('drops a user who appears again on the next page', () => {
    const first: RankingEntry[] = [
      { userId: 'user-1', nickname: '하나', balanceWei: '10', rank: 1 },
      { userId: 'user-2', nickname: '둘', balanceWei: '9', rank: 2 },
    ]
    const second: RankingEntry[] = [
      { userId: 'user-1', nickname: '하나', balanceWei: '10', rank: 1 },
      { userId: 'user-3', nickname: '셋', balanceWei: '8', rank: 3 },
    ]

    expect(dedupedRankingEntries([first, second]).map((entry) => entry.userId)).toEqual([
      'user-1',
      'user-2',
      'user-3',
    ])
  })

  it('formats wei with bigint instead of a rounded number', () => {
    expect(formatRankingBalance(`${5n * 10n ** 18n}`)).toBe('5')
    expect(formatRankingBalance(`${15n * 10n ** 17n}`)).toBe('1.5')
    expect(formatRankingBalance('1.5')).toBeNull()
  })

  it('paginates the stored snapshot by rank on the server', () => {
    const source = refreshSource

    expect(source).toContain('multicall')
    expect(source).toContain('rankPlayers')
    expect(migrationSql).toContain('p_page_size is distinct from 20')
    expect(migrationSql).toContain('order by rank asc')
    expect(migrationSql).toContain('rank > p_after_rank')
  })
})
