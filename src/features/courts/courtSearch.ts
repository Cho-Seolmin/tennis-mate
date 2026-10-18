import { distanceMeters, type LatLngLiteral } from './distance.ts'
import type { CourtRadius } from './radiusStorage.ts'
import './mapsTypes.ts'

export type CourtResult = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  distanceMeters: number
  mapsUrl: string
}

const placeFields = ['id', 'displayName', 'formattedAddress', 'location', 'googleMapsURI'] as const

type PlaceLocation = LatLngLiteral | { lat: () => number; lng: () => number }

type GooglePlace = {
  id?: string
  displayName?: string | null
  formattedAddress?: string | null
  location?: PlaceLocation | null
  googleMapsURI?: string | null
}

type PlacesLibrary = {
  Place: {
    searchNearby: (request: Record<string, unknown>) => Promise<{ places: GooglePlace[] }>
    searchByText: (request: Record<string, unknown>) => Promise<{ places: GooglePlace[] }>
  }
  SearchNearbyRankPreference?: { DISTANCE?: string }
  SearchByTextRankPreference?: { DISTANCE?: string }
}

const inflight = new Map<string, Promise<CourtResult[]>>()

export function searchTennisCourts(origin: LatLngLiteral, radius: CourtRadius) {
  const key = `${origin.lat.toFixed(5)}:${origin.lng.toFixed(5)}:${radius}`
  const existing = inflight.get(key)

  if (existing) {
    return existing
  }

  const promise = runSearch(origin, radius)
  inflight.set(key, promise)
  void promise.finally(() => {
    if (inflight.get(key) === promise) {
      inflight.delete(key)
    }
  })

  return promise
}

async function runSearch(origin: LatLngLiteral, radius: CourtRadius) {
  const center = { lat: origin.lat, lng: origin.lng }
  const places = await loadPlaces()
  const nearby = await searchNearby(places, center, radius)

  if (nearby.length > 0) {
    return nearby
  }

  return searchByText(places, center, radius)
}

async function loadPlaces() {
  const maps = window.google?.maps

  if (!maps?.importLibrary) {
    throw new Error('Google Maps를 불러오지 못했습니다.')
  }

  return (await maps.importLibrary('places')) as PlacesLibrary
}

async function searchNearby(places: PlacesLibrary, origin: LatLngLiteral, radius: CourtRadius) {
  // tennis_court 유형은 Nearby Search 필터로 거절될 수 있어, 실패하거나 비면 Text Search를 사용한다.
  try {
    const { places: found } = await places.Place.searchNearby({
      fields: [...placeFields],
      locationRestriction: {
        center: origin,
        radius,
      },
      includedTypes: ['tennis_court'],
      maxResultCount: 20,
      rankPreference: places.SearchNearbyRankPreference?.DISTANCE ?? 'DISTANCE',
      language: 'ko',
      region: 'kr',
    })

    return toCourtResults(found, origin, radius, false)
  } catch {
    return []
  }
}

async function searchByText(places: PlacesLibrary, origin: LatLngLiteral, radius: CourtRadius) {
  const { places: found } = await places.Place.searchByText({
    textQuery: '테니스장',
    fields: [...placeFields],
    locationBias: {
      center: origin,
      radius,
    },
    maxResultCount: 20,
    rankPreference: places.SearchByTextRankPreference?.DISTANCE ?? 'DISTANCE',
    language: 'ko',
    region: 'kr',
  })

  return toCourtResults(found, origin, radius, true)
}

function toCourtResults(
  places: GooglePlace[],
  origin: LatLngLiteral,
  radius: number,
  requireTennisName: boolean,
) {
  const results = new Map<string, CourtResult>()

  for (const place of places) {
    const position = readPosition(place.location)
    const name = place.displayName?.trim() ?? ''

    if (!position || name === '') {
      continue
    }

    if (requireTennisName && !isTennisName(name)) {
      continue
    }

    const distance = distanceMeters(origin, position)

    if (distance > radius) {
      continue
    }

    const id = place.id || `${position.lat},${position.lng}`
    results.set(id, {
      id,
      name,
      address: place.formattedAddress?.trim() || '주소 없음',
      lat: position.lat,
      lng: position.lng,
      distanceMeters: distance,
      mapsUrl: place.googleMapsURI || mapsPlaceUrl(name, position, place.id),
    })
  }

  return [...results.values()].sort((left, right) => left.distanceMeters - right.distanceMeters)
}

function readPosition(location: PlaceLocation | null | undefined): LatLngLiteral | null {
  if (!location) {
    return null
  }

  const lat = typeof location.lat === 'function' ? location.lat() : location.lat
  const lng = typeof location.lng === 'function' ? location.lng() : location.lng

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  return { lat, lng }
}

function isTennisName(name: string) {
  const normalized = name.toLowerCase()
  return normalized.includes('테니스') || normalized.includes('tennis')
}

function mapsPlaceUrl(name: string, position: LatLngLiteral, placeId: string | undefined) {
  const params = new URLSearchParams({
    api: '1',
    query: placeId ? name : `${position.lat},${position.lng}`,
  })

  if (placeId) {
    params.set('query_place_id', placeId)
  }

  return `https://www.google.com/maps/search/?${params.toString()}`
}
