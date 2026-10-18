import type { ReactNode } from 'react'

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function HomeIcon() {
  return (
    <NavIcon>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1Z" />
    </NavIcon>
  )
}

export function CommunityIcon() {
  return (
    <NavIcon>
      <path d="M6 16.5 4 20l3.8-1.4A8 8 0 1 0 6 16.5Z" />
    </NavIcon>
  )
}

export function RewardsIcon() {
  return (
    <NavIcon>
      <circle cx="12" cy="12" r="7" />
      <path d="M8.5 9.2c1.3 1.5 1.3 4.1 0 5.6M15.5 9.2c-1.3 1.5-1.3 4.1 0 5.6" />
    </NavIcon>
  )
}

export function MatchesIcon() {
  return (
    <NavIcon>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M12 5v14M3.5 12h17" />
    </NavIcon>
  )
}

export function RankingIcon() {
  return (
    <NavIcon>
      <path d="M7 20V10M12 20V4M17 20v-7" />
    </NavIcon>
  )
}

export function CourtsIcon() {
  return (
    <NavIcon>
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
      <circle cx="12" cy="11" r="1.5" />
    </NavIcon>
  )
}
