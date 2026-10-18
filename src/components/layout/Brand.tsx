type BrandProps = {
  tone?: 'default' | 'inverse'
}

export function Brand({ tone = 'default' }: BrandProps) {
  const textClass = tone === 'inverse' ? 'text-white' : 'text-ink'

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <BallMark />
      <span className={`truncate font-display text-lg font-semibold tracking-tight ${textClass}`}>
        Tennis Mate
      </span>
    </span>
  )
}

function BallMark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-court-700 text-ball">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
        <circle cx="12" cy="12" r="7" fill="currentColor" />
        <path
          d="M8.2 9.2c1.5 1.6 1.5 4 0 5.6M15.8 9.2c-1.5 1.6-1.5 4 0 5.6"
          fill="none"
          stroke="#173f2b"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
