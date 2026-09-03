import {
  addMonths,
  bookingDayLabel,
  bookingsByDay,
  bookingsOnDate,
  calendarDays,
  dateKey,
  dayIsOutsideMonth,
  dayIsSelected,
  dayIsToday,
  initialSelectedDate,
  monthLabel,
  startOfMonth,
  type CalendarBooking,
} from '@/data/bookingCalendar'

const now = new Date(2026, 7, 15)

function booking(id: string, requestedAt: number, status: string): CalendarBooking {
  return { _id: id, requestedAt, status }
}

describe('booking calendar dates', () => {
  it('normalizes a date to the first day of its month', () => {
    const start = startOfMonth(new Date(2026, 7, 26))
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(7)
    expect(start.getDate()).toBe(1)
  })

  it('adds months while staying on the first day', () => {
    const start = startOfMonth(new Date(2026, 11, 10))
    expect(addMonths(start, 1)).toEqual(new Date(2027, 0, 1))
    expect(addMonths(start, -1)).toEqual(new Date(2026, 10, 1))
  })

  it('renders a stable YYYY-MM-DD key from dates and timestamps', () => {
    expect(dateKey(new Date(2026, 7, 3))).toBe('2026-08-03')
    expect(dateKey(new Date(2026, 7, 3).getTime())).toBe('2026-08-03')
  })

  it('labels the visible month and selected day', () => {
    expect(monthLabel(2026, 7)).toBe('August 2026')
  })

  it('counts booking labels', () => {
    expect(bookingDayLabel(1)).toBe('1 booking')
    expect(bookingDayLabel(3)).toBe('3 bookings')
  })

  it('builds a 42-cell grid starting on the Sunday of the week before the month', () => {
    const days = calendarDays(2026, 7)
    expect(days.length).toBe(42)
    expect(days[0].getDay()).toBe(0)
    expect(dateKey(days[0])).toBe('2026-07-26')
    expect(dateKey(days[41])).toBe('2026-09-05')
  })

  it('classifies day comparisons', () => {
    const selected = new Date(2026, 7, 12)
    expect(dayIsSelected(new Date(2026, 7, 12), selected)).toBe(true)
    expect(dayIsSelected(new Date(2026, 7, 13), selected)).toBe(false)
    expect(dayIsToday(new Date(2026, 7, 15), now)).toBe(true)
    expect(dayIsToday(new Date(2026, 7, 16), now)).toBe(false)
    expect(dayIsOutsideMonth(new Date(2026, 6, 31), 2026, 7)).toBe(true)
    expect(dayIsOutsideMonth(new Date(2026, 7, 1), 2026, 7)).toBe(false)
  })
})

describe('booking calendar grouping', () => {
  const bookings = [
    booking('a', new Date(2026, 7, 3).getTime(), 'accepted'),
    booking('b', new Date(2026, 7, 3).getTime(), 'request_sent'),
    booking('c', new Date(2026, 7, 20).getTime(), 'completed'),
  ]

  it('groups bookings by their requested day', () => {
    const byDay = bookingsByDay(bookings)
    expect(byDay.get('2026-08-03')?.map((item) => item._id)).toEqual(['a', 'b'])
    expect(byDay.get('2026-08-20')?.map((item) => item._id)).toEqual(['c'])
  })

  it('returns bookings that fall on a selected date', () => {
    expect(bookingsOnDate(bookings, new Date(2026, 7, 3)).map((item) => item._id)).toEqual(['a', 'b'])
    expect(bookingsOnDate(bookings, new Date(2026, 7, 4))).toEqual([])
  })

  it('selects a linked booking date when a booking id is provided', () => {
    expect(initialSelectedDate(bookings, 'c', now)).toEqual(new Date(2026, 7, 20))
  })

  it('selects the next upcoming active booking or the latest active one', () => {
    const active = [
      booking('past', new Date(2026, 6, 1).getTime(), 'accepted'),
      booking('upcoming', new Date(2026, 7, 25).getTime(), 'accepted'),
    ]
    expect(initialSelectedDate(active, undefined, now)).toEqual(new Date(2026, 7, 25))

    const allPast = [booking('recent', new Date(2026, 6, 30).getTime(), 'accepted')]
    expect(initialSelectedDate(allPast, undefined, now)).toEqual(new Date(2026, 6, 30))
  })

  it('falls back to today when there are no active bookings', () => {
    expect(initialSelectedDate([], undefined, now)).toEqual(now)
  })
})
