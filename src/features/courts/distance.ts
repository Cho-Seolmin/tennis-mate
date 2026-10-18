export type LatLngLiteral = {
  lat: number
  lng: number
}

const earthRadiusMeters = 6_371_000

export function distanceMeters(from: LatLngLiteral, to: LatLngLiteral) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(to.lat - from.lat)
  const longitudeDelta = toRadians(to.lng - from.lng)
  const fromLatitude = toRadians(from.lat)
  const toLatitude = toRadians(to.lat)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2

  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(haversine)))
}

export function formatDistance(meters: number) {
  if (!Number.isFinite(meters) || meters < 0) {
    return ''
  }

  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }

  return `${(meters / 1000).toFixed(1)}km`
}
