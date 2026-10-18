import { useEffect, useRef, useState } from 'react'
import type { CourtResult } from './courtSearch.ts'
import type { CourtOrigin } from './origin.ts'
import type { CourtRadius } from './radiusStorage.ts'
import type {
  GoogleInfoWindow,
  GoogleMap,
  GoogleMarker,
  GoogleMarkerConstructor,
  MapsLibrary,
} from './mapsTypes.ts'

type CourtMapProps = {
  origin: CourtOrigin
  radius: CourtRadius
  courts: CourtResult[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CourtMap({ origin, radius, courts, selectedId, onSelect }: CourtMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<GoogleMap | null>(null)
  const infoRef = useRef<GoogleInfoWindow | null>(null)
  const markerCtorRef = useRef<GoogleMarkerConstructor | null>(null)
  const [ready, setReady] = useState(false)
  const [mapError, setMapError] = useState('')

  useEffect(() => {
    const container = containerRef.current
    const mapsNamespace = window.google?.maps

    if (!container || mapRef.current || !mapsNamespace) {
      return
    }

    let cancelled = false

    void mapsNamespace
      .importLibrary('maps')
      .then((library) => {
        if (cancelled || mapRef.current || !containerRef.current) {
          return
        }

        const maps = library as MapsLibrary
        const InfoWindow = maps.InfoWindow ?? window.google?.maps.InfoWindow
        const Marker = maps.Marker ?? window.google?.maps.Marker

        if (!InfoWindow || !Marker) {
          throw new Error('지도 도구를 찾지 못했습니다.')
        }

        markerCtorRef.current = Marker
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: origin.lat, lng: origin.lng },
          zoom: zoomForRadius(radius),
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        })
        infoRef.current = new InfoWindow()
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setMapError('Google Maps를 불러오지 못했습니다.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [origin.lat, origin.lng, radius])

  useEffect(() => {
    return () => {
      infoRef.current?.close()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const Marker = markerCtorRef.current

    if (!ready || !map || !Marker) {
      return
    }

    const listeners: Array<{ remove: () => void }> = []
    const markers: GoogleMarker[] = []
    const userMarker = new Marker({
      map,
      position: { lat: origin.lat, lng: origin.lng },
      title: origin.kind === 'current' ? '현재 위치' : '기본 위치',
      zIndex: 2,
      icon: userMarkerIcon(),
    })
    markers.push(userMarker)

    let selectedMarker: GoogleMarker | null = null

    for (const court of courts) {
      const marker = new Marker({
        map,
        position: { lat: court.lat, lng: court.lng },
        title: court.name,
      })
      listeners.push(
        marker.addListener('click', () => {
          onSelect(court.id)
        }),
      )
      markers.push(marker)

      if (court.id === selectedId) {
        selectedMarker = marker
      }
    }

    if (selectedId) {
      const selected = courts.find((court) => court.id === selectedId)

      if (selected) {
        const position = { lat: selected.lat, lng: selected.lng }
        map.panTo(position)
        map.setZoom(16)
        infoRef.current?.setContent(infoContent(selected))
        infoRef.current?.open({ map, anchor: selectedMarker ?? undefined })
      }
    } else {
      infoRef.current?.close()
      map.setZoom(zoomForRadius(radius))
    }

    return () => {
      for (const listener of listeners) {
        listener.remove()
      }

      for (const marker of markers) {
        marker.setMap(null)
      }
    }
  }, [ready, courts, origin, radius, selectedId, onSelect])

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-court-50">
      <div
        ref={containerRef}
        role="region"
        aria-label="테니스장 지도"
        className="h-72 w-full md:h-96 lg:h-[32rem]"
      />
      {mapError ? <p className="px-4 py-3 text-sm text-danger">{mapError}</p> : null}
      {!ready && !mapError ? (
        <p className="px-4 py-3 text-sm text-court-800">지도 표시를 준비하고 있습니다.</p>
      ) : null}
    </div>
  )
}

function zoomForRadius(radius: CourtRadius) {
  if (radius <= 1000) {
    return 15
  }

  if (radius <= 3000) {
    return 14
  }

  return 13
}

function userMarkerIcon() {
  const circle = window.google?.maps.SymbolPath?.CIRCLE

  if (circle === undefined) {
    return undefined
  }

  return {
    path: circle,
    scale: 8,
    fillColor: '#1c5336',
    fillOpacity: 1,
    strokeColor: '#e3f56a',
    strokeWeight: 3,
  }
}

function infoContent(court: CourtResult) {
  const content = document.createElement('div')
  const title = document.createElement('strong')
  const address = document.createElement('div')
  title.textContent = court.name
  address.textContent = court.address
  content.append(title, address)
  return content
}
