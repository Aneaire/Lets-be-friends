import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const app = readFileSync(fileURLToPath(new URL('../../src/routes/app.tsx', import.meta.url)), 'utf8')
const companion = readFileSync(fileURLToPath(new URL('../../src/routes/companion.tsx', import.meta.url)), 'utf8')
const companionRow = readFileSync(fileURLToPath(new URL('../../src/features/booking/CompanionBookingRow.tsx', import.meta.url)), 'utf8')

describe('member /app combined bookings calendar', () => {
  it('queries bookings for the signed-in Companion whenever a viewer exists', () => {
    expect(app).toContain("const companionBookings = useQuery(api.bookings.forCompanion, viewer ? {} : 'skip')")
  })

  it('waits for the Companion bookings query before rendering live counts', () => {
    expect(app).toContain('companionBookings !== undefined')
  })

  it('combines both collections into one calendar source with a participant resolver', () => {
    expect(app).toContain('combineCalendarBookings(bookings, companionBookings)')
    expect(app).toContain('bookings={combinedBookings}')
    expect(app).toContain('participantName={(booking) => calendarParticipantName(booking)}')
  })

  it('dispatches Companion-side entries through the shared Companion booking row', () => {
    expect(app).toContain("import { CompanionBookingRow, companionStatusPresentation } from '../features/booking/CompanionBookingRow'")
    expect(app).toContain('renderCompanionBookingRow')
    expect(app).toContain("<CompanionBookingRow")
  })

  it('exposes Companion-side bookings in the cards view instead of hiding them', () => {
    expect(app).toContain('Bookings as Companion')
    expect(app).toContain('companionSideBookings.map(renderBookingRow)')
  })

  it('keeps the member and Companion rows on distinct DOM id prefixes for safe deep links', () => {
    expect(app).toContain('companion-booking-${bookingId}')
    expect(companionRow).toContain('companion-booking-${booking._id}')
  })
})

describe('Companion booking row reuse', () => {
  it('renders the same extracted row from both the member and Companion workspaces', () => {
    expect(companion).toContain("import { CompanionBookingRow, companionStatusPresentation } from '../features/booking/CompanionBookingRow'")
    expect(companion).toContain('<CompanionBookingRow')
    expect(companion).not.toContain('function CompanionBookingRow')
  })
})
