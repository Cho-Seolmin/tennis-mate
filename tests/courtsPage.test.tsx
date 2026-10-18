import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CourtsPage } from '../src/features/courts/CourtsPage.tsx'
import { SEOUL_CITY_HALL } from '../src/features/courts/origin.ts'
import { COURT_RADIUS_STORAGE_KEY } from '../src/features/courts/radiusStorage.ts'

vi.mock('../src/lib/env.ts', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/env.ts')>('../src/lib/env.ts')

  return {
    ...actual,
    isMapsConfigured: true,
    env: {
      ...actual.env,
      googleMapsApiKey: 'test-maps-key',
    },
  }
})

afterEach(() => {
  cleanup()
  delete window.google
  window.sessionStorage.removeItem(COURT_RADIUS_STORAGE_KEY)
})

describe('courts page', () => {
  it('shows the same nearby courts on the map and in the list', async () => {
    const user = userEvent.setup()
    const google = installGoogle()
    mockLocation(37.5, 127)

    renderCourts()

    expect(await screen.findByRole('button', { name: /한강 테니스장/ })).toBeInTheDocument()
    expect(screen.queryByText('잠실 테니스장')).not.toBeInTheDocument()
    expect(screen.queryByText('카페')).not.toBeInTheDocument()
    expect(screen.getByText('현재 위치를 기준으로 검색합니다.')).toBeInTheDocument()
    expect(google.markers.some((marker) => marker.title === '현재 위치')).toBe(true)
    expect(google.markers.some((marker) => marker.title === '한강 테니스장')).toBe(true)
    expect(screen.getByRole('link', { name: 'Google 지도에서 보기' })).toHaveAttribute(
      'href',
      'https://maps.google.com/?cid=near',
    )

    await user.click(screen.getByRole('button', { name: /한강 테니스장/ }))

    expect(google.pans).toContainEqual({ lat: 37.501, lng: 127 })
    expect(google.mapsCreated).toBe(1)

    await user.click(screen.getByRole('radio', { name: '5km' }))

    await waitFor(() => {
      expect(google.searchByText).toHaveBeenCalledTimes(2)
    })
    expect(google.mapsCreated).toBe(1)
    expect(window.sessionStorage.getItem(COURT_RADIUS_STORAGE_KEY)).toBe('5000')
  })

  it('labels Seoul City Hall as the default location when permission is denied', async () => {
    const google = installGoogle()
    mockDeniedLocation()

    renderCourts()

    expect(
      await screen.findByText(/서울시청 주변의 기본 위치를 사용합니다\. 현재 위치가 아닙니다\./),
    ).toBeInTheDocument()
    expect(screen.queryByText('현재 위치를 기준으로 검색합니다.')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(google.searchByText).toHaveBeenCalled()
    })
    expect(google.searchByText.mock.calls[0]?.[0]).toMatchObject({
      locationBias: { center: SEOUL_CITY_HALL, radius: 3000 },
    })
    expect(google.markers.some((marker) => marker.title === '기본 위치')).toBe(true)
  })
})

function renderCourts() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CourtsPage />
    </QueryClientProvider>,
  )
}

function mockLocation(latitude: number, longitude: number) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition(success: PositionCallback) {
        success({
          coords: {
            latitude,
            longitude,
            accuracy: 1,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON() {
              return this
            },
          },
          timestamp: Date.now(),
          toJSON() {
            return this
          },
        })
      },
    },
  })
}

function mockDeniedLocation() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition(_success: PositionCallback, error?: PositionErrorCallback) {
        error?.({
          code: 1,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
          message: 'denied',
        } as GeolocationPositionError)
      },
    },
  })
}

function installGoogle() {
  const state = {
    mapsCreated: 0,
    markers: [] as Array<{ title?: string; position: { lat: number; lng: number } }>,
    pans: [] as Array<{ lat: number; lng: number }>,
    searchNearby: vi.fn(async (_request: Record<string, unknown>) => ({ places: [] })),
    searchByText: vi.fn(async (_request: Record<string, unknown>) => ({
      places: [
        place('near', '한강 테니스장', 37.501, 127, 'https://maps.google.com/?cid=near'),
        place('far', '잠실 테니스장', 37.6, 127),
        place('cafe', '카페', 37.501, 127),
      ],
    })),
  }

  class Map {
    constructor() {
      state.mapsCreated += 1
    }

    panTo(position: { lat: number; lng: number }) {
      state.pans.push(position)
    }

    setZoom() {}
  }

  class Marker {
    options: { title?: string; position: { lat: number; lng: number } }

    constructor(options: { title?: string; position: { lat: number; lng: number } }) {
      this.options = options
      state.markers.push(options)
    }

    setMap() {}

    addListener() {
      return { remove() {} }
    }
  }

  class InfoWindow {
    setContent() {}

    open() {}

    close() {}
  }

  window.google = {
    maps: {
      Marker,
      InfoWindow,
      SymbolPath: { CIRCLE: 0 },
      importLibrary: async (name: string) => {
        if (name === 'places') {
          return {
            Place: {
              searchNearby: state.searchNearby,
              searchByText: state.searchByText,
            },
            SearchNearbyRankPreference: { DISTANCE: 'DISTANCE' },
            SearchByTextRankPreference: { DISTANCE: 'DISTANCE' },
          }
        }

        return { Map, Marker, InfoWindow }
      },
    },
  }

  return state
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
