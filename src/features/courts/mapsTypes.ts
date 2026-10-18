import type { LatLngLiteral } from './distance.ts'

export type GoogleMap = {
  panTo: (position: LatLngLiteral) => void
  setZoom: (zoom: number) => void
}

export type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void
  addListener: (eventName: string, handler: () => void) => { remove: () => void }
}

export type GoogleInfoWindow = {
  setContent: (content: Node) => void
  open: (options: { map: GoogleMap; anchor?: GoogleMarker }) => void
  close: () => void
}

export type GoogleMapConstructor = new (
  element: HTMLElement,
  options: {
    center: LatLngLiteral
    zoom: number
    mapTypeControl: boolean
    streetViewControl: boolean
    fullscreenControl: boolean
    clickableIcons: boolean
  },
) => GoogleMap

export type GoogleMarkerConstructor = new (options: {
  map: GoogleMap
  position: LatLngLiteral
  title: string
  zIndex?: number
  icon?: {
    path: number
    scale: number
    fillColor: string
    fillOpacity: number
    strokeColor: string
    strokeWeight: number
  }
}) => GoogleMarker

export type GoogleInfoWindowConstructor = new () => GoogleInfoWindow

export type MapsLibrary = {
  Map: GoogleMapConstructor
  Marker?: GoogleMarkerConstructor
  InfoWindow?: GoogleInfoWindowConstructor
}

declare global {
  interface Window {
    google?: {
      maps: {
        importLibrary: (name: string) => Promise<unknown>
        Marker?: GoogleMarkerConstructor
        InfoWindow?: GoogleInfoWindowConstructor
        SymbolPath?: { CIRCLE: number }
      }
    }
  }
}
