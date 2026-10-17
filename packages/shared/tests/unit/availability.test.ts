import { describe, expect, it } from 'vitest'
import {
  MANILA_TIMEZONE,
  availableStartsForManilaDate,
  manilaDateParts,
  manilaDatesInMonth,
  manilaInstant,
  manilaMidnightMs,
  parseAvailabilityMonth,
  sessionFitsWeeklyAvailability,
  validateWeeklyAvailability,
  weekdayOfDate,
  type WeeklyAvailabilityWindow,
} from '../../src'

const SUNDAY = 0
const MONDAY = 1
const SUNDAY_0900_1200: WeeklyAvailabilityWindow = { weekday: SUNDAY, startMinutes: 9 * 60, endMinutes: 12 * 60 }
const MONDAY_0900_1000: WeeklyAvailabilityWindow = { weekday: MONDAY, startMinutes: 9 * 60, endMinutes: 10 * 60 }

describe('weekly availability validation', () => {
  it('accepts a valid schedule and sorts it by weekday then start', () => {
    const result = validateWeeklyAvailability([
      { weekday: MONDAY, startMinutes: 600, endMinutes: 720 },
      { weekday: SUNDAY, startMinutes: 540, endMinutes: 600 },
      { weekday: MONDAY, startMinutes: 540, endMinutes: 600 },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual([
      { weekday: SUNDAY, startMinutes: 540, endMinutes: 600 },
      { weekday: MONDAY, startMinutes: 540, endMinutes: 600 },
      { weekday: MONDAY, startMinutes: 600, endMinutes: 720 },
    ])
  })

  it('allows windows that touch at the boundary but rejects real overlaps', () => {
    const touching = validateWeeklyAvailability([
      { weekday: SUNDAY, startMinutes: 540, endMinutes: 600 },
      { weekday: SUNDAY, startMinutes: 600, endMinutes: 660 },
    ])
    expect(touching.ok).toBe(true)

    const overlapping = validateWeeklyAvailability([
      { weekday: SUNDAY, startMinutes: 540, endMinutes: 615 },
      { weekday: SUNDAY, startMinutes: 600, endMinutes: 660 },
    ])
    expect(overlapping.ok).toBe(false)
    if (!overlapping.ok) expect(overlapping.message).toMatch(/overlap/)
  })

  it('rejects an out-of-range weekday and malformed minute ranges', () => {
    expect(validateWeeklyAvailability([{ weekday: 7, startMinutes: 0, endMinutes: 60 }]).ok).toBe(false)
    expect(validateWeeklyAvailability([{ weekday: -1, startMinutes: 0, endMinutes: 60 }]).ok).toBe(false)
    expect(validateWeeklyAvailability([{ weekday: 1.5, startMinutes: 0, endMinutes: 60 }]).ok).toBe(false)
    expect(validateWeeklyAvailability([{ weekday: SUNDAY, startMinutes: -15, endMinutes: 60 }]).ok).toBe(false)
    expect(validateWeeklyAvailability([{ weekday: SUNDAY, startMinutes: 600, endMinutes: 600 }]).ok).toBe(false)
    expect(validateWeeklyAvailability([{ weekday: SUNDAY, startMinutes: 600, endMinutes: 1500 }]).ok).toBe(false)
  })

  it('rejects times that are not on a 15-minute boundary and non-integer minutes', () => {
    expect(validateWeeklyAvailability([{ weekday: SUNDAY, startMinutes: 545, endMinutes: 600 }]).ok).toBe(false)
    expect(validateWeeklyAvailability([{ weekday: SUNDAY, startMinutes: 540, endMinutes: 601 }]).ok).toBe(false)
    expect(validateWeeklyAvailability([{ weekday: SUNDAY, startMinutes: 540.5, endMinutes: 600 }]).ok).toBe(false)
  })

  it('rejects more than 28 windows', () => {
    const windows: WeeklyAvailabilityWindow[] = []
    for (let day = 0; day < 7; day += 1) {
      for (let index = 0; index < 5; index += 1) {
        windows.push({ weekday: day, startMinutes: index * 30, endMinutes: index * 30 + 30 })
      }
    }
    expect(windows).toHaveLength(35)
    const result = validateWeeklyAvailability(windows)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/28/)
  })
})

describe('Manila month and date mapping', () => {
  it('parses a strict, bounded YYYY-MM month', () => {
    expect(parseAvailabilityMonth('2026-12')).toEqual({ year: 2026, month: 12 })
    expect(parseAvailabilityMonth('2000-01')).toEqual({ year: 2000, month: 1 })
    expect(parseAvailabilityMonth('2100-12')).toEqual({ year: 2100, month: 12 })
    for (const invalid of ['2026-13', '2026-00', '2026-1', '26-12', 'abc', '1999-12', '2101-01', '2026-12-01']) {
      expect(parseAvailabilityMonth(invalid)).toBeNull()
    }
  })

  it('maps instants to Manila calendar dates, weekdays, and minute-of-day', () => {
    // 2026-12-07 09:30 Manila is 2026-12-07 01:30 UTC.
    const parts = manilaDateParts(Date.UTC(2026, 11, 7, 1, 30))
    expect(parts).toMatchObject({ year: 2026, month: 12, day: 7, date: '2026-12-07', weekday: MONDAY, minuteOfDay: 570 })
    expect(MANILA_TIMEZONE).toBe('Asia/Manila')
    expect(manilaInstant('2026-12-07', 570)).toBe(Date.UTC(2026, 11, 7, 1, 30))
    expect(manilaMidnightMs(2026, 12, 7)).toBe(Date.UTC(2026, 11, 6, 16, 0))
    expect(weekdayOfDate(2026, 12, 6)).toBe(SUNDAY)
  })

  it('lists every date in a Manila month', () => {
    const dates = manilaDatesInMonth(2026, 12)
    expect(dates).toHaveLength(31)
    expect(dates[0]).toBe('2026-12-01')
    expect(dates[30]).toBe('2026-12-31')
    expect(manilaDatesInMonth(2026, 2)).toHaveLength(28)
  })
})

describe('session window fitting', () => {
  it('accepts a session whose true end lands exactly on the window end', () => {
    expect(sessionFitsWeeklyAvailability({
      windows: [MONDAY_0900_1000],
      requestedAt: manilaInstant('2026-12-07', 9 * 60 + 45),
      durationMinutes: 15,
    })).toBe(true)
  })

  it('rejects a start that is not exactly on the 15-minute boundary', () => {
    expect(sessionFitsWeeklyAvailability({
      windows: [MONDAY_0900_1000],
      requestedAt: manilaInstant('2026-12-07', 9 * 60 + 45) + 1_000,
      durationMinutes: 15,
    })).toBe(false)
    expect(sessionFitsWeeklyAvailability({
      windows: [MONDAY_0900_1000],
      requestedAt: manilaInstant('2026-12-07', 9 * 60 + 45) + 500,
      durationMinutes: 15,
    })).toBe(false)
    expect(sessionFitsWeeklyAvailability({
      windows: [MONDAY_0900_1000],
      requestedAt: manilaInstant('2026-12-07', 9 * 60 + 7),
      durationMinutes: 15,
    })).toBe(false)
  })

  it('rejects a session that runs past the window end', () => {
    expect(sessionFitsWeeklyAvailability({
      windows: [MONDAY_0900_1000],
      requestedAt: manilaInstant('2026-12-07', 9 * 60 + 45),
      durationMinutes: 30,
    })).toBe(false)
  })

  it('rejects a session that would cross local midnight and a missing duration', () => {
    const lateWindow: WeeklyAvailabilityWindow = { weekday: MONDAY, startMinutes: 23 * 60, endMinutes: 1440 }
    expect(sessionFitsWeeklyAvailability({
      windows: [lateWindow],
      requestedAt: manilaInstant('2026-12-07', 23 * 60 + 45),
      durationMinutes: 30,
    })).toBe(false)
    expect(sessionFitsWeeklyAvailability({
      windows: [lateWindow],
      requestedAt: manilaInstant('2026-12-07', 23 * 60),
      durationMinutes: 0,
    })).toBe(false)
  })
})

describe('available slot computation', () => {
  const date = '2026-12-06'
  const windows = [SUNDAY_0900_1200]

  function starts(durationMinutes: number, now: number, busy: Array<{ start: number; end: number }> = []) {
    return availableStartsForManilaDate({ date, windows, durationMinutes, now, busy })
  }

  it('returns every aligned start that fits the window for a future date', () => {
    expect(starts(60, manilaInstant(date, 0))).toEqual([540, 555, 570, 585, 600, 615, 630, 645, 660])
  })

  it('drops starts that are not strictly in the future', () => {
    expect(starts(60, manilaInstant(date, 10 * 60))).toEqual([615, 630, 645, 660])
  })

  it('removes starts that overlap a busy interval', () => {
    const busy = [{ start: manilaInstant(date, 10 * 60), end: manilaInstant(date, 11 * 60) }]
    expect(starts(60, manilaInstant(date, 0), busy)).toEqual([540, 660])
  })

  it('returns no starts for a date whose weekday has no window', () => {
    const monday = availableStartsForManilaDate({
      date: '2026-12-07',
      windows,
      durationMinutes: 60,
      now: manilaInstant('2026-12-07', 0),
      busy: [],
    })
    expect(monday).toEqual([])
  })

  it('returns no starts for an invalid duration', () => {
    expect(starts(0, 0)).toEqual([])
    expect(starts(-15, 0)).toEqual([])
  })
})
