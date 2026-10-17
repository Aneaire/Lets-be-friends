import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

const app = read('../../src/routes/app.tsx')
const companionProfile = read('../../src/routes/companion-profile.tsx')
const bookingDialog = read('../../src/features/booking/BookingDialog.tsx')
const bookingRequestFields = read('../../src/features/booking/BookingRequestFields.tsx')

describe('shared booking dialog extraction', () => {
  it('moves the dialog and its Companion option type out of the /app route', () => {
    expect(app).toContain("import { BookingDialog, type ApprovedCompanionOption } from '../features/booking/BookingDialog'")
    expect(app).not.toContain('function BookingDialog(')
    expect(app).not.toContain('type ApprovedCompanionOption = {')
    expect(bookingDialog).toContain('export type ApprovedCompanionOption = {')
    expect(bookingDialog).toContain('export function BookingDialog(')
  })

  it('keeps the /app Companion deep link wired into the shared dialog', () => {
    expect(app).toContain('initialCompanionProfileId={companionProfileId}')
  })

  it('lets the profile flow fix the Companion and hide the discovery list', () => {
    expect(bookingDialog).toContain('fixedCompanion?: ApprovedCompanionOption')
    expect(companionProfile).toContain("import { BookingDialog, type ApprovedCompanionOption } from '../features/booking/BookingDialog'")
    expect(companionProfile).not.toContain('companions.listApproved')
    expect(companionProfile).toContain('fixedCompanion={companion}')
  })

  it('schedules through the connected availability picker instead of free-text time controls', () => {
    expect(bookingDialog).toContain("import { BookingAvailabilityPicker } from '../scheduling/BookingAvailabilityPicker'")
    expect(bookingDialog).toContain('<BookingAvailabilityPicker')
    expect(bookingDialog).toContain('requestedAt: selectedStart')
    expect(bookingDialog).toContain('showScheduling={false}')
    // The edit dialog keeps its date and time fields through the shared flag.
    expect(bookingRequestFields).toContain('showScheduling?: boolean')
  })
})
