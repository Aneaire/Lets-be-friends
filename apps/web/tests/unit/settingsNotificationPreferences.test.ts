import { describe, expect, it } from 'vitest'
import {
  digestSummary,
  minuteToLabel,
  minuteToTimeInput,
  quietHoursSummary,
  resolveBrowserTimeZone,
  timeInputToMinute,
} from '../../src/features/settings/notificationPreferences'

describe('notification preference time helpers', () => {
  it('formats a stored minute of day as a readable 12 hour label', () => {
    expect(minuteToLabel(0)).toBe('12:00 AM')
    expect(minuteToLabel(420)).toBe('7:00 AM')
    expect(minuteToLabel(720)).toBe('12:00 PM')
    expect(minuteToLabel(1080)).toBe('6:00 PM')
    expect(minuteToLabel(1320)).toBe('10:00 PM')
    expect(minuteToLabel(1439)).toBe('11:59 PM')
  })

  it('converts a stored minute to and from a native time input value', () => {
    expect(minuteToTimeInput(1320)).toBe('22:00')
    expect(minuteToTimeInput(435)).toBe('07:15')
    expect(minuteToTimeInput(1439)).toBe('23:59')
    expect(timeInputToMinute('22:00')).toBe(1320)
    expect(timeInputToMinute('07:15')).toBe(435)
    expect(timeInputToMinute('23:59')).toBe(1439)
  })

  it('rejects an invalid time input instead of storing it', () => {
    expect(timeInputToMinute('')).toBeNull()
    expect(timeInputToMinute('24:00')).toBeNull()
    expect(timeInputToMinute('10:75')).toBeNull()
    expect(timeInputToMinute('ten')).toBeNull()
  })

  it('falls back to UTC when the browser time zone is unavailable', () => {
    expect(resolveBrowserTimeZone(() => 'Asia/Manila')).toBe('Asia/Manila')
    expect(resolveBrowserTimeZone(() => undefined)).toBe('UTC')
    expect(resolveBrowserTimeZone(() => '   ')).toBe('UTC')
    expect(resolveBrowserTimeZone(() => {
      throw new Error('Intl is unavailable')
    })).toBe('UTC')
  })

  it('describes the daily digest from the stored toggle and time', () => {
    expect(digestSummary(false, 1080)).toBe('Social updates arrive as they happen. A daily digest would arrive at 6:00 PM.')
    expect(digestSummary(true, 480)).toBe('Social updates arrive in one daily summary at 8:00 AM.')
  })

  it('describes the quiet hours window from the stored minutes', () => {
    expect(quietHoursSummary(true, 1320, 420)).toBe('Quiet hours run from 10:00 PM to 7:00 AM.')
    expect(quietHoursSummary(false, 1320, 420)).toBe('Quiet hours are off. Social alerts can arrive at any time.')
  })
})
