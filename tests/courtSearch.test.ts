import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchTennisCourts } from '../src/features/courts/courtSearch.ts'

afterEach(() => {
  delete window.google
})

describe('tennis court search', () => {
  it('uses nearby results when the tennis court type returns places', async () => {
    const nearby = vi.fn(async (_request: Record<string, unknown>) => ({
      places: [place('near', '한강 테니스장', 37.501, 127)],
    }))
    const text = vi.fn()
    installPlaces(nearby, text)

    const results = await searchTennisCourts({ lat: 37.5, lng: 127 }, 3000)

    expect(nearby).toHaveBeenCalledTimes(1)
    expect(text).not.toHaveBeenCalled()
    expect(results.map((item) => item.name)).toEqual(['한강 테니스장'])
    expect(nearby.mock.calls[0]?.[0]).toMatchObject({
      includedTypes: ['tennis_court'],
      locationRestriction: { center: { lat: 37.5, lng: 127 }, radius: 3000 },
    })
  })

  it('falls back to text search and keeps only tennis courts inside the radius', async () => {
    const nearby = vi.fn(async (_request: Record<string, unknown>) => {
      throw new Error('unsupported type')
    })
    const text = vi.fn(async (_request: Record<string, unknown>) => ({
      places: [
        place('near', '한강 테니스장', 37.501, 127, 'https://maps.google.com/?cid=near'),
        place('far', '잠실 테니스장', 37.6, 127),
        place('cafe', '카페', 37.501, 127),
      ],
    }))
    installPlaces(nearby, text)

    const results = await searchTennisCourts({ lat: 37.5, lng: 127 }, 3000)

    expect(text).toHaveBeenCalledTimes(1)
    expect(results).toHaveLength(1)
    expect(results[0]?.name).toBe('한강 테니스장')
    expect(results[0]?.mapsUrl).toBe('https://maps.google.com/?cid=near')
    expect(results[0]?.address).toBe('서울시 영등포구')
  })

  it('shares one request for the same origin and radius', async () => {
    const nearby = vi.fn(
      () =>
        new Promise<{ places: ReturnType<typeof place>[] }>((resolve) => {
          resolve({ places: [place('near', '한강 테니스장', 37.501, 127)] })
        }),
    )
    installPlaces(nearby, vi.fn())

    const [first, second] = await Promise.all([
      searchTennisCourts({ lat: 37.5, lng: 127 }, 3000),
      searchTennisCourts({ lat: 37.5, lng: 127 }, 3000),
    ])

    expect(first).toBe(second)
    expect(nearby).toHaveBeenCalledTimes(1)
  })
})

function installPlaces(
  searchNearby: (request: Record<string, unknown>) => Promise<{ places: ReturnType<typeof place>[] }>,
  searchByText: (request: Record<string, unknown>) => Promise<{ places: ReturnType<typeof place>[] }>,
) {
  window.google = {
    maps: {
      importLibrary: async () => ({
        Place: { searchNearby, searchByText },
        SearchNearbyRankPreference: { DISTANCE: 'DISTANCE' },
        SearchByTextRankPreference: { DISTANCE: 'DISTANCE' },
      }),
    },
  }
}

function place(id: string, name: string, lat: number, lng: number, mapsUrl?: string) {
  return {
    id,
    displayName: name,
    formattedAddress: '서울시 영등포구',
    location: { lat: () => lat, lng: () => lng },
    googleMapsURI: mapsUrl ?? null,
  }
}
