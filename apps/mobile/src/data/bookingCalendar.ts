export type BookingsViewMode = 'calendar' | 'cards'

export type CalendarBooking = {
  _id: string
  requestedAt: number
  status: string
}

export const activeBookingStatuses = new Set(['request_sent', 'accepted', 'verification_required'])

export const calendarWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

export function dateKey(value: Date | number) {
  const date = typeof value === 'number' ? new Date(value) : value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function longDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function bookingDayLabel(count: number) {
  return count === 1 ? '1 booking' : `${count} bookings`
}

export function calendarDays(visibleYear: number, visibleMonth: number) {
  const firstWeekday = new Date(visibleYear, visibleMonth, 1).getDay()
  return Array.from({ length: 42 }, (_, index) => (
    new Date(visibleYear, visibleMonth, index - firstWeekday + 1)
  ))
}

export function bookingsByDay<TBooking extends CalendarBooking>(bookings: TBooking[]) {
  const dates = new Map<string, TBooking[]>()
  for (const booking of bookings) {
    const key = dateKey(booking.requestedAt)
    dates.set(key, [...(dates.get(key) ?? []), booking])
  }
  return dates
}

export function bookingsOnDate<TBooking extends CalendarBooking>(bookings: TBooking[], date: Date) {
  return bookingsByDay(bookings).get(dateKey(date)) ?? []
}

export function initialSelectedDate<TBooking extends CalendarBooking>(
  bookings: TBooking[],
  bookingId: string | undefined,
  now = new Date(),
) {
  const linkedBooking = bookingId
    ? bookings.find((booking) => String(booking._id) === bookingId)
    : undefined
  if (linkedBooking) return new Date(linkedBooking.requestedAt)

  const active = bookings
    .filter((booking) => activeBookingStatuses.has(booking.status))
    .sort((a, b) => a.requestedAt - b.requestedAt)
  const upcoming = active.find((booking) => booking.requestedAt >= now.getTime())
  if (upcoming) return new Date(upcoming.requestedAt)
  if (active.length > 0) return new Date(active[active.length - 1].requestedAt)
  return now
}

export function dayIsOutsideMonth(date: Date, visibleYear: number, visibleMonth: number) {
  return date.getMonth() !== visibleMonth || date.getFullYear() !== visibleYear
}

export function dayIsSelected(date: Date, selectedDate: Date) {
  return dateKey(date) === dateKey(selectedDate)
}

export function dayIsToday(date: Date, now = new Date()) {
  return dateKey(date) === dateKey(now)
}
