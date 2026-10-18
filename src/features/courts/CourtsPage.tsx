import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader.tsx'
import { DemoModeNotice } from '../../components/ui/DemoModeNotice.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { env, isMapsConfigured } from '../../lib/env.ts'
import { CourtList } from './CourtList.tsx'
import { CourtMap } from './CourtMap.tsx'
import { searchTennisCourts, type CourtResult } from './courtSearch.ts'
import { loadGoogleMaps } from './loadGoogleMaps.ts'
import { requestCourtOrigin, type CourtOrigin } from './origin.ts'
import { RadiusPicker } from './RadiusPicker.tsx'
import {
  readCourtRadius,
  writeCourtRadius,
  type CourtRadius,
} from './radiusStorage.ts'

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error'

export function CourtsPage() {
  const [radius, setRadius] = useState(() => readCourtRadius())
  const [origin, setOrigin] = useState<CourtOrigin | null>(null)
  const [locating, setLocating] = useState(isMapsConfigured)
  const [mapStatus, setMapStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    isMapsConfigured ? 'loading' : 'idle',
  )
  const [mapAttempt, setMapAttempt] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const canSearch = isMapsConfigured && mapStatus === 'ready' && origin !== null
  const courtsQuery = useQuery({
    queryKey: ['tennis-courts', origin?.lat, origin?.lng, radius],
    enabled: canSearch,
    retry: false,
    queryFn: () => {
      if (!origin) {
        throw new Error('위치가 없습니다.')
      }

      return searchTennisCourts(origin, radius)
    },
  })
  const courts = courtsQuery.data ?? []
  const searchStatus: SearchStatus = !canSearch
    ? 'idle'
    : courtsQuery.isPending
      ? 'loading'
      : courtsQuery.isError
        ? 'error'
        : 'ready'

  useEffect(() => {
    if (!isMapsConfigured) {
      return
    }

    let active = true

    void requestCourtOrigin().then((next) => {
      if (!active) {
        return
      }

      setOrigin(next)
      setLocating(false)
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isMapsConfigured) {
      return
    }

    let active = true

    void loadGoogleMaps(env.googleMapsApiKey)
      .then(() => {
        if (active) {
          setMapStatus('ready')
        }
      })
      .catch(() => {
        if (active) {
          setMapStatus('error')
        }
      })

    return () => {
      active = false
    }
  }, [mapAttempt])

  function selectRadius(next: CourtRadius) {
    setRadius(next)
    writeCourtRadius(next)
    setSelectedId(null)
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="코트"
        description="현재 위치 주변의 테니스장을 지도와 목록에 함께 보여 줍니다."
      />
      <RadiusPicker radius={radius} onChange={selectRadius} />
      {isMapsConfigured ? (
        <CourtSearch
          origin={origin}
          locating={locating}
          mapStatus={mapStatus}
          radius={radius}
          searchStatus={searchStatus}
          courts={courts}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRetryMap={() => {
            setMapStatus('loading')
            setMapAttempt((attempt) => attempt + 1)
          }}
          onRetrySearch={() => {
            void courtsQuery.refetch()
          }}
        />
      ) : (
        <>
          <DemoModeNotice
            service="Google Maps"
            detail="API 키가 없어 Demo Mode입니다. 지도와 테니스장 검색을 실행하지 않습니다."
          />
          <EmptyState
            title="테니스장을 표시하지 않습니다"
            description="Google Maps API 키를 설정하면 현재 위치 주변 테니스장을 검색합니다."
          />
        </>
      )}
    </section>
  )
}

type CourtSearchProps = {
  origin: CourtOrigin | null
  locating: boolean
  mapStatus: 'idle' | 'loading' | 'ready' | 'error'
  radius: CourtRadius
  searchStatus: SearchStatus
  courts: CourtResult[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRetryMap: () => void
  onRetrySearch: () => void
}

function CourtSearch({
  origin,
  locating,
  mapStatus,
  radius,
  searchStatus,
  courts,
  selectedId,
  onSelect,
  onRetryMap,
  onRetrySearch,
}: CourtSearchProps) {
  return (
    <div className="space-y-4">
      {locating ? <Loading label="현재 위치를 확인하는 중" /> : null}
      {origin?.kind === 'current' ? (
        <p role="status" className="text-sm leading-6 text-ink/75">
          현재 위치를 기준으로 검색합니다.
        </p>
      ) : null}
      {origin?.kind === 'default' ? (
        <p role="status" className="rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6 text-ink">
          {origin.reason === 'denied'
            ? '위치 권한이 거부되어 서울시청 주변의 기본 위치를 사용합니다. 현재 위치가 아닙니다.'
            : '위치를 가져오지 못해 서울시청 주변의 기본 위치를 사용합니다. 현재 위치가 아닙니다.'}
        </p>
      ) : null}
      {mapStatus === 'loading' ? <Loading label="지도를 불러오는 중" /> : null}
      {mapStatus === 'error' ? (
        <ErrorMessage
          title="지도를 불러오지 못했습니다"
          message="Google Maps API 응답을 확인해 주세요."
          onRetry={onRetryMap}
        />
      ) : null}
      {mapStatus === 'ready' && origin ? (
        <CourtMap
          origin={origin}
          radius={radius}
          courts={courts}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : null}
      {searchStatus === 'idle' ? null : (
        <CourtList
          status={searchStatus}
          courts={courts}
          selectedId={selectedId}
          errorMessage="주변 테니스장을 검색하지 못했습니다."
          onSelect={onSelect}
          onRetry={onRetrySearch}
        />
      )}
      <p className="text-xs leading-5 text-ink/60">장소 정보는 Google Maps에서 제공됩니다.</p>
    </div>
  )
}
