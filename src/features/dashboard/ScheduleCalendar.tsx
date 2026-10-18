import { useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { formatLongDate, formatMonth, monthGrid, scheduleOverlapsDay, toDateKey } from './dateTime.ts'

type ScheduleCalendarProps = {
  month: Date
  selectedDate: Date
  schedules: Array<{ start_at: string; end_at: string }>
  onMonthChange: (month: Date) => void
  onSelectDate: (date: Date) => void
}

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

export function ScheduleCalendar({
  month,
  selectedDate,
  schedules,
  onMonthChange,
  onSelectDate,
}: ScheduleCalendarProps) {
  const [today] = useState(() => new Date())
  const days = monthGrid(month)
  const selectedKey = toDateKey(selectedDate)
  const todayKey = toDateKey(today)

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          aria-label="이전 달"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        >
          이전
        </Button>
        <h2 className="font-display text-xl font-semibold text-ink">{formatMonth(month)}</h2>
        <Button
          variant="secondary"
          aria-label="다음 달"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        >
          다음
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink/55" aria-hidden="true">
        {weekdays.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>
      <div role="group" aria-label="월간 달력" className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = toDateKey(day)
          const inMonth = day.getMonth() === month.getMonth()
          const selected = key === selectedKey
          const today = key === todayKey
          const hasSchedule = schedules.some((item) => scheduleOverlapsDay(item, day))
          const label = hasSchedule ? `${formatLongDate(day)}, 일정 있음` : formatLongDate(day)

          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              aria-label={label}
              data-has-schedule={hasSchedule ? 'true' : 'false'}
              className={[
                'relative flex min-h-11 w-full min-w-0 items-center justify-center rounded-xl text-sm font-medium',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700',
                selected
                  ? 'bg-court-700 text-white'
                  : inMonth
                    ? 'text-ink hover:bg-court-50'
                    : 'text-ink/35 hover:bg-court-50',
                !selected && today ? 'ring-2 ring-court-700' : '',
              ].join(' ')}
              onClick={() => onSelectDate(day)}
            >
              {day.getDate()}
              {hasSchedule ? (
                <span
                  aria-hidden="true"
                  className={[
                    'absolute bottom-1 size-1.5 rounded-full',
                    selected ? 'bg-ball' : 'bg-court-700',
                  ].join(' ')}
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
