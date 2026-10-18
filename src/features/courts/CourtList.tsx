import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { formatDistance } from './distance.ts'
import type { CourtResult } from './courtSearch.ts'

type CourtListProps = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  courts: CourtResult[]
  selectedId: string | null
  errorMessage?: string
  onSelect: (id: string) => void
  onRetry: () => void
}

export function CourtList({
  status,
  courts,
  selectedId,
  errorMessage,
  onSelect,
  onRetry,
}: CourtListProps) {
  return (
    <section aria-labelledby="court-results-heading" className="min-w-0">
      <h2 id="court-results-heading" className="text-lg font-semibold text-ink">
        주변 테니스장
      </h2>
      <div className="mt-3">
        {status === 'loading' ? <Loading label="주변 테니스장을 검색하는 중" /> : null}
        {status === 'error' ? (
          <ErrorMessage
            title="테니스장을 검색하지 못했습니다"
            message={errorMessage ?? '다시 시도해 주세요.'}
            onRetry={onRetry}
          />
        ) : null}
        {status === 'ready' && courts.length === 0 ? (
          <EmptyState
            title="이 반경 안에 테니스장이 없습니다"
            description="반경을 넓히면 더 멀리 있는 테니스장을 찾을 수 있습니다."
          />
        ) : null}
        {status === 'ready' && courts.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {courts.map((court) => {
              const selected = court.id === selectedId

              return (
                <li
                  key={court.id}
                  className={[
                    'min-w-0 rounded-2xl border bg-white p-4',
                    selected ? 'border-court-700' : 'border-line',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    className="w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700"
                    aria-pressed={selected}
                    onClick={() => {
                      onSelect(court.id)
                    }}
                  >
                    <span className="block break-words text-base font-semibold text-ink">{court.name}</span>
                    <span className="mt-1 block break-words text-sm leading-6 text-ink/75">{court.address}</span>
                    <span className="mt-2 block text-sm font-medium text-court-800">
                      직선거리 {formatDistance(court.distanceMeters)}
                    </span>
                  </button>
                  <a
                    className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-court-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700"
                    href={court.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google 지도에서 보기
                  </a>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
