export const COURT_RADIUS_STORAGE_KEY = 'tennis-mate:courts:radius'

export const courtRadii = [1000, 3000, 5000] as const

export type CourtRadius = (typeof courtRadii)[number]

export const defaultCourtRadius: CourtRadius = 3000

type RadiusStorage = Pick<Storage, 'getItem' | 'setItem'>

export function parseCourtRadius(value: string | null): CourtRadius {
  if (value === '1000' || value === '3000' || value === '5000') {
    return Number(value) as CourtRadius
  }

  return defaultCourtRadius
}

export function readCourtRadius(storage: RadiusStorage | null = browserSession()): CourtRadius {
  if (!storage) {
    return defaultCourtRadius
  }

  try {
    const raw = storage.getItem(COURT_RADIUS_STORAGE_KEY)
    const radius = parseCourtRadius(raw)

    if (raw !== null && raw !== String(radius)) {
      storage.setItem(COURT_RADIUS_STORAGE_KEY, String(radius))
    }

    return radius
  } catch {
    return defaultCourtRadius
  }
}

export function writeCourtRadius(
  radius: CourtRadius,
  storage: RadiusStorage | null = browserSession(),
) {
  try {
    storage?.setItem(COURT_RADIUS_STORAGE_KEY, String(radius))
  } catch {
    // 화면의 선택 값은 유지하고, 저장소가 막혀 있으면 이번 탭에서만 사용합니다.
  }
}

function browserSession() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}
