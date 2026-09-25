import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const companion = readFileSync(fileURLToPath(new URL('../../src/routes/companion.tsx', import.meta.url)), 'utf8')

describe('Companion bookings calendar', () => {
  it('uses the shared calendar and cards switch for Companion bookings', () => {
    expect(companion).toContain("import { BookingsView, type BookingsViewMode } from '../features/booking/BookingsView'")
    expect(companion).toContain('<BookingsView')
    expect(companion).toContain("useState<BookingsViewMode>('calendar')")
    expect(companion).toContain('onViewChange={setBookingsView}')
  })

  it('resolves day summaries to member names instead of Companion names', () => {
    expect(companion).toContain('participantName={(booking) => booking.memberDisplayName}')
  })

  it('keeps the incoming requests and history card presentations', () => {
    expect(companion).toContain('Incoming requests')
    expect(companion).toContain('id="history"')
    expect(companion).toContain('activeBookings.map(renderCompanionBooking)')
    expect(companion).toContain('historyBookings.map(renderCompanionBooking)')
  })

  it('shows a calendar skeleton instead of fake zero counts while the booking query loads', () => {
    expect(companion).toContain("import { BookingsViewSkeleton } from '../features/booking/AppPageSkeleton'")
    expect(companion).toContain('<BookingsViewSkeleton />')
    expect(companion).toContain('const bookingsReady = bookings !== undefined')
    expect(companion).toContain('<BookingCount ready={bookingsReady}')
    expect(companion).not.toContain('Loading requests')
  })
})
