import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')
const story = readFileSync(fileURLToPath(new URL('../../src/features/booking/BookingDialog.stories.tsx', import.meta.url)), 'utf8')

describe('booking dialog centered modal styles', () => {
  it('centers the dialog with balanced all-side chrome instead of a right drawer', () => {
    expect(styles).toMatch(/\.booking-dialog-backdrop\s*\{[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*\}/s)
    expect(styles).not.toMatch(/\.booking-dialog-backdrop\s*\{[^}]*justify-content:\s*flex-end;/s)
    expect(styles).toMatch(/\.booking-dialog\s*\{[^}]*border:\s*1px solid var\(--border\);[^}]*\}/s)
    expect(styles).toMatch(/\.booking-dialog\s*\{[^}]*border-radius:\s*1\.25rem;[^}]*\}/s)
    expect(styles).toMatch(/\.booking-dialog\s*\{[^}]*max-height:\s*100%;[^}]*\}/s)
    // The drawer-era left-only radius that produced the narrow side panel is gone.
    expect(styles).not.toContain('border-radius: 1.5rem 0 0 1.5rem')
    expect(styles).not.toMatch(/\.booking-dialog\s*\{[^}]*border-left:\s*1px solid var\(--border\);[^}]*\}/s)
  })

  it('keeps a stable header over a single internal scroll body', () => {
    expect(styles).toMatch(/\.booking-dialog-header\s*\{[^}]*flex:\s*0 0 auto;/s)
    expect(styles).toMatch(/\.booking-dialog-body\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s)
  })

  it('lays the calendar beside the details and stacks it first when narrow', () => {
    expect(styles).toMatch(/\.booking-dialog-layout\s*\{[^}]*grid-template-columns:[^}]*minmax\(0, 1\.25fr\) minmax\(0, 1fr\);/s)
    expect(styles).toMatch(/@media \(max-width:\s*800px\)\s*\{\s*\.booking-dialog-layout\s*\{[^}]*grid-template-columns:\s*1fr;/s)
  })

  it('bounds the Companion avatar and wraps its identity text', () => {
    expect(styles).toMatch(/\.booking-companion-search-avatar\s*\{[^}]*width:\s*3rem;[^}]*height:\s*3rem;[^}]*overflow:\s*hidden;/s)
    expect(styles).toMatch(/\.booking-companion-search-avatar img\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*cover;/s)
    expect(styles).toMatch(/\.booking-companion-summary-text\s*\{[^}]*min-width:\s*0;/s)
    expect(styles).toMatch(/\.booking-companion-summary-text (?:strong|small)\s*\{[^}]*overflow-wrap:\s*anywhere;/s)
  })

  it('covers the centered modal through real component stories, not hand-rolled markup', () => {
    expect(story).toContain("from './BookingDialogFrame'")
    expect(story).toContain('<BookingDialogFrame')
    expect(story).toContain('<BookingDialogLayout')
    expect(story).toContain('<AvailabilityCalendar')
    expect(story).toContain('<BookingRequestFields')
  })
})
