import type { LatLngLiteral } from './distance.ts'

export const SEOUL_CITY_HALL: LatLngLiteral = {
  lat: 37.566535,
  lng: 126.977969,
}

export type CourtOrigin =
  | { kind: 'current'; lat: number; lng: number }
  | { kind: 'default'; lat: number; lng: number; reason: 'denied' | 'unavailable' }

export function requestCourtOrigin(
  geolocation: Geolocation | null = browserGeolocation(),
): Promise<CourtOrigin> {
  const fallback = (reason: 'denied' | 'unavailable'): CourtOrigin => ({
    kind: 'default',
    ...SEOUL_CITY_HALL,
    reason,
  })

  if (!geolocation) {
    return Promise.resolve(fallback('unavailable'))
  }

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) => {
        resolve({
          kind: 'current',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        resolve(fallback(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'))
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    )
  })
}

function browserGeolocation() {
  try {
    return navigator.geolocation ?? null
  } catch {
    return null
  }
}
