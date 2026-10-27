import {
  FALLBACK_TIME_ZONE,
  formatMinuteLabel,
  isSupportedTimeZone,
  minuteOfDayOptions,
  normalizeMinuteOfDay,
  parseMinuteLabel,
  resolveDeviceTimeZone,
  TIME_OPTION_STEP_MINUTES,
  timeOptionLabels,
} from '@/notifications/preferenceTime'

describe('notification preference time labels', () => {
  it('renders a human 12 hour label for every stored minute', () => {
    expect(formatMinuteLabel(0)).toBe('12:00 AM')
    expect(formatMinuteLabel(60)).toBe('1:00 AM')
    expect(formatMinuteLabel(420)).toBe('7:00 AM')
    expect(formatMinuteLabel(720)).toBe('12:00 PM')
    expect(formatMinuteLabel(1080)).toBe('6:00 PM')
    expect(formatMinuteLabel(1320)).toBe('10:00 PM')
    expect(formatMinuteLabel(1410)).toBe('11:30 PM')
    expect(formatMinuteLabel(1439)).toBe('11:59 PM')
  })

  it('normalizes minutes outside the day instead of producing an invalid label', () => {
    expect(normalizeMinuteOfDay(-1)).toBe(1439)
    expect(normalizeMinuteOfDay(1440)).toBe(0)
    expect(normalizeMinuteOfDay(1441)).toBe(1)
    expect(normalizeMinuteOfDay(Number.NaN)).toBe(0)
    expect(formatMinuteLabel(-30)).toBe('11:30 PM')
  })
})

describe('notification preference time options', () => {
  it('generates one 30 minute option per half hour, from 00:00 to 23:30', () => {
    const options = minuteOfDayOptions()

    expect(TIME_OPTION_STEP_MINUTES).toBe(30)
    expect(options).toHaveLength(48)
    expect(options[0]).toBe(0)
    expect(options[options.length - 1]).toBe(1410)
    expect(options.every((minute) => minute % 30 === 0)).toBe(true)
    expect(options).toEqual([...options].sort((left, right) => left - right))
  })

  it('pairs every option with its display label', () => {
    const labels = timeOptionLabels()

    expect(labels).toHaveLength(minuteOfDayOptions().length)
    expect(labels[0]).toEqual({ minute: 0, label: '12:00 AM' })
    expect(labels[labels.length - 1]).toEqual({ minute: 1410, label: '11:30 PM' })
    expect(labels).toContainEqual({ minute: 720, label: '12:00 PM' })
  })

  it('rejects an unusable step instead of looping forever', () => {
    expect(minuteOfDayOptions(0)).toHaveLength(48)
    expect(minuteOfDayOptions(Number.NaN)).toHaveLength(48)
  })
})

describe('notification preference label conversion', () => {
  it('converts a displayed label back to the stored minute', () => {
    expect(parseMinuteLabel('12:00 AM')).toBe(0)
    expect(parseMinuteLabel('12:00 PM')).toBe(720)
    expect(parseMinuteLabel('11:30 PM')).toBe(1410)
    expect(parseMinuteLabel('10:00 PM')).toBe(1320)
    expect(parseMinuteLabel(' 7:00 am ')).toBe(420)
  })

  it('round trips every picker option', () => {
    for (const option of timeOptionLabels()) {
      expect(parseMinuteLabel(option.label)).toBe(option.minute)
    }
  })

  it('rejects malformed labels instead of guessing a time', () => {
    expect(parseMinuteLabel('')).toBeNull()
    expect(parseMinuteLabel('10:00')).toBeNull()
    expect(parseMinuteLabel('0:30 AM')).toBeNull()
    expect(parseMinuteLabel('13:00 PM')).toBeNull()
    expect(parseMinuteLabel('10:60 AM')).toBeNull()
    expect(parseMinuteLabel('noon')).toBeNull()
  })
})

describe('notification preference time zone detection', () => {
  it('keeps a supported device zone', () => {
    expect(resolveDeviceTimeZone(() => 'Asia/Manila')).toBe('Asia/Manila')
    expect(resolveDeviceTimeZone(() => ' Asia/Manila ')).toBe('Asia/Manila')
  })

  it('falls back to UTC when the runtime exposes no zone', () => {
    expect(resolveDeviceTimeZone(() => undefined)).toBe(FALLBACK_TIME_ZONE)
    expect(resolveDeviceTimeZone(() => null)).toBe(FALLBACK_TIME_ZONE)
    expect(resolveDeviceTimeZone(() => '')).toBe(FALLBACK_TIME_ZONE)
    expect(resolveDeviceTimeZone(() => '   ')).toBe(FALLBACK_TIME_ZONE)
  })

  it('falls back to UTC when reading the zone throws', () => {
    expect(FALLBACK_TIME_ZONE).toBe('UTC')
    expect(resolveDeviceTimeZone(() => {
      throw new Error('Intl unavailable')
    })).toBe('UTC')
    expect(resolveDeviceTimeZone(
      () => 'Asia/Manila',
      () => {
        throw new Error('validator unavailable')
      },
    )).toBe('UTC')
  })

  it('falls back to UTC when the device reports an unknown zone', () => {
    expect(isSupportedTimeZone('Nowhere/Invalid')).toBe(false)
    expect(isSupportedTimeZone('')).toBe(false)
    expect(resolveDeviceTimeZone(() => 'Nowhere/Invalid')).toBe('UTC')
  })
})
