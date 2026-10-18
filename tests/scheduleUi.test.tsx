import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScheduleCalendar } from '../src/features/dashboard/ScheduleCalendar.tsx'
import { ScheduleForm } from '../src/features/dashboard/ScheduleForm.tsx'
import { ScheduleList } from '../src/features/dashboard/ScheduleList.tsx'
import type { Schedule } from '../src/types/database.ts'

afterEach(() => {
  cleanup()
})

const schedule: Schedule = {
  id: 'schedule-1',
  user_id: 'user-1',
  title: '아침 연습',
  start_at: new Date(2026, 9, 17, 9, 0).toISOString(),
  end_at: new Date(2026, 9, 17, 10, 0).toISOString(),
  location: '한강 코트',
  memo: null,
  created_at: '2026-10-17T00:00:00.000Z',
}

describe('schedule calendar', () => {
  it('moves the month and selects a date', async () => {
    const user = userEvent.setup()
    const onMonthChange = vi.fn()
    const onSelectDate = vi.fn()

    render(
      <ScheduleCalendar
        month={new Date(2026, 9, 1)}
        selectedDate={new Date(2026, 9, 17)}
        schedules={[schedule]}
        onMonthChange={onMonthChange}
        onSelectDate={onSelectDate}
      />,
    )

    expect(screen.getByRole('heading', { name: /2026년 10월/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /10월 17일, 일정 있음/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: '다음 달' }))
    expect(onMonthChange).toHaveBeenCalledWith(new Date(2026, 10, 1))

    await user.click(screen.getByRole('button', { name: /10월 18일$/ }))
    expect(onSelectDate).toHaveBeenCalledWith(new Date(2026, 9, 18))
  })
})

describe('schedule form', () => {
  it('shows field errors and does not submit an incomplete schedule', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <ScheduleForm
        submitting={false}
        onSubmit={onSubmit}
        defaultValues={{
          title: '',
          start_at: '2026-10-18T10:00',
          end_at: '2026-10-18T09:00',
          location: '',
          memo: '',
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: '일정 저장' }))

    expect(await screen.findByText('제목을 입력해 주세요.')).toBeInTheDocument()
    expect(screen.getByText('종료 시간은 시작 시간보다 늦어야 합니다.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits only after the schedule is valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <ScheduleForm
        submitting={false}
        onSubmit={onSubmit}
        defaultValues={{
          title: '',
          start_at: '2026-10-18T10:00',
          end_at: '2026-10-18T11:00',
          location: '',
          memo: '',
        }}
      />,
    )

    await user.type(screen.getByLabelText('제목'), '아침 연습')
    await user.click(screen.getByRole('button', { name: '일정 저장' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      title: '아침 연습',
      start_at: '2026-10-18T10:00',
      end_at: '2026-10-18T11:00',
    })
  })
})

describe('schedule list', () => {
  it('shows an empty day and a saved schedule separately from the loading state', () => {
    const props = {
      date: new Date(2026, 9, 18),
      deletingId: null,
      onRetry: vi.fn(),
      onCreate: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    }

    const { rerender } = render(
      <ScheduleList {...props} schedules={[]} status="loading" />,
    )
    expect(screen.getByText('일정을 불러오는 중')).toBeInTheDocument()
    expect(screen.queryByText('이 날짜에 일정이 없습니다')).not.toBeInTheDocument()

    rerender(<ScheduleList {...props} schedules={[]} status="ready" />)
    expect(screen.getByText('이 날짜에 일정이 없습니다')).toBeInTheDocument()

    rerender(<ScheduleList {...props} schedules={[schedule]} status="ready" />)
    expect(screen.getByText('아침 연습')).toBeInTheDocument()
    expect(screen.getByText('한강 코트')).toBeInTheDocument()
  })
})
