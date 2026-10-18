export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1)
}

export function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function monthGrid(month: Date) {
  const first = startOfMonth(month)
  const start = new Date(first)
  start.setDate(1 - first.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

export function gridRange(month: Date) {
  const days = monthGrid(month)
  const start = startOfDay(days[0] ?? startOfMonth(month))
  const last = days[41] ?? start
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
  return { days, start, end }
}

export function parseLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])

  if (month < 1 || month > 12 || hour > 23 || minute > 59) {
    return null
  }

  const date = new Date(year, month - 1, day, hour, minute, 0, 0)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

export function isValidLocalDateTime(value: string) {
  return parseLocalDateTime(value) !== null
}

export function localDateTimeToIso(value: string) {
  const date = parseLocalDateTime(value)

  if (!date) {
    throw new Error('올바른 날짜와 시간을 입력해 주세요.')
  }

  return date.toISOString()
}

export function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function defaultScheduleRange(day: Date) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0, 0)
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0, 0, 0)
  return {
    start_at: toLocalInputValue(start),
    end_at: toLocalInputValue(end),
  }
}

export function scheduleOverlapsDay(
  schedule: { start_at: string; end_at: string },
  day: Date,
) {
  const rangeStart = startOfDay(day).getTime()
  const rangeEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime()
  const eventStart = new Date(schedule.start_at).getTime()
  const eventEnd = new Date(schedule.end_at).getTime()
  return eventStart < rangeEnd && eventEnd > rangeStart
}

const fullDateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' })
const monthFormat = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' })
const dayFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' })
const longDateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' })

export function formatFullDate(date: Date) {
  return fullDateFormat.format(date)
}

export function formatMonth(date: Date) {
  return monthFormat.format(date)
}

export function formatLongDate(date: Date) {
  return longDateFormat.format(date)
}

export function formatScheduleRange(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)

  if (toDateKey(start) === toDateKey(end)) {
    return `${timeFormat.format(start)} – ${timeFormat.format(end)}`
  }

  return `${dayFormat.format(start)} ${timeFormat.format(start)} – ${dayFormat.format(end)} ${timeFormat.format(end)}`
}
