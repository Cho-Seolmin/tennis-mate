import { courtRadii, type CourtRadius } from './radiusStorage.ts'

const radiusLabels: Record<CourtRadius, string> = {
  1000: '1km',
  3000: '3km',
  5000: '5km',
}

type RadiusPickerProps = {
  radius: CourtRadius
  onChange: (radius: CourtRadius) => void
}

export function RadiusPicker({ radius, onChange }: RadiusPickerProps) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-ink">검색 반경</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {courtRadii.map((value) => {
          const selected = radius === value

          return (
            <label
              key={value}
              className={[
                'inline-flex min-h-11 min-w-16 cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold',
                'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-court-700',
                selected ? 'bg-court-700 text-white' : 'border border-line bg-white text-court-900',
              ].join(' ')}
            >
              <input
                className="sr-only"
                type="radio"
                name="court-radius"
                value={value}
                checked={selected}
                onChange={() => {
                  onChange(value)
                }}
              />
              {radiusLabels[value]}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
