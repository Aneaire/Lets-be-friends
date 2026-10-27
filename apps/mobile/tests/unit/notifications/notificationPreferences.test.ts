import {
  applyNotificationPreferencePatch,
  digestTimeRow,
  notificationTimePatch,
  notificationTimeZonePatch,
  notificationTogglePatch,
  notificationToggleRows,
  NOTIFICATION_SAVE_ERROR,
  quietHoursTimeRows,
  saveNotificationPreference,
  type NotificationPreferenceValues,
} from '@/notifications/notificationPreferences'
import { resolveDeviceTimeZone } from '@/notifications/preferenceTime'

function values(overrides: Partial<NotificationPreferenceValues> = {}): NotificationPreferenceValues {
  return {
    socialReactions: true,
    socialComments: true,
    socialFollows: true,
    circleActivity: true,
    quietHoursEnabled: false,
    quietHoursStartMinute: 1320,
    quietHoursEndMinute: 420,
    timeZone: 'Asia/Manila',
    digestEnabled: false,
    digestHourMinute: 1080,
    ...overrides,
  }
}

describe('notification preference controls', () => {
  it('lists the four categories, quiet hours, and the digest with stored values', () => {
    const rows = notificationToggleRows(values({ circleActivity: false, digestEnabled: true }))

    expect(rows.map((row) => row.label)).toEqual([
      'Reactions',
      'Comments and replies',
      'New followers',
      'Circle activity',
      'Quiet hours',
      'Daily digest',
    ])
    expect(rows.map((row) => row.checked)).toEqual([true, true, true, false, false, true])
    expect(rows.find((row) => row.field === 'socialReactions')?.detail).toBe(
      'Post likes, comment likes, and review likes',
    )
  })

  it('disables every control while one save is in flight and marks the changed one busy', () => {
    const rows = notificationToggleRows(values(), 'socialComments')

    expect(rows.find((row) => row.field === 'socialComments')).toMatchObject({
      busy: true,
      disabled: true,
    })
    expect(rows.find((row) => row.field === 'socialReactions')).toMatchObject({
      busy: false,
      disabled: true,
    })
  })

  it('sends only the toggled field when a category switch is saved', async () => {
    const current = values({ socialComments: true })
    const update = jest.fn(async () => ({}))

    const result = await saveNotificationPreference({
      values: current,
      patch: notificationTogglePatch(current, 'socialComments'),
      update,
    })

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({ socialComments: false })
    expect(result).toEqual({
      status: 'saved',
      values: expect.objectContaining({ socialComments: false }),
    })
  })
})

describe('notification quiet hours state', () => {
  it('shows no time rows while quiet hours are off', () => {
    expect(quietHoursTimeRows(values({ quietHoursEnabled: false }))).toBeNull()
  })

  it('shows the stored From and To times while quiet hours are on', () => {
    const rows = quietHoursTimeRows(values({ quietHoursEnabled: true }))

    expect(rows?.[0]).toMatchObject({
      field: 'quietHoursStartMinute',
      label: 'From',
      minute: 1320,
      timeLabel: '10:00 PM',
      accessibilityLabel: 'Quiet hours start, 10:00 PM',
    })
    expect(rows?.[1]).toMatchObject({
      field: 'quietHoursEndMinute',
      label: 'To',
      minute: 420,
      timeLabel: '7:00 AM',
      accessibilityLabel: 'Quiet hours end, 7:00 AM',
    })
  })

  it('locks the time rows while the window edit is saving', () => {
    const rows = quietHoursTimeRows(values({ quietHoursEnabled: true }), 'quietHoursStartMinute')

    expect(rows?.[0]).toMatchObject({ busy: true, disabled: true })
    expect(rows?.[1]).toMatchObject({ busy: false, disabled: true })
  })

  it('sends the selected minute of day for a quiet hours pick', () => {
    expect(notificationTimePatch('quietHoursStartMinute', 1380)).toEqual({
      quietHoursStartMinute: 1380,
    })
    expect(notificationTimePatch('quietHoursEndMinute', 1440)).toEqual({
      quietHoursEndMinute: 0,
    })
  })
})

describe('notification digest state', () => {
  it('hides the send time until the digest is on', () => {
    expect(digestTimeRow(values({ digestEnabled: false }))).toBeNull()
  })

  it('shows the stored send time and saves the picked minute', () => {
    const row = digestTimeRow(values({ digestEnabled: true, digestHourMinute: 1080 }))

    expect(row).toMatchObject({
      label: 'Send at',
      timeLabel: '6:00 PM',
      minute: 1080,
      accessibilityLabel: 'Daily digest time, 6:00 PM',
    })
    expect(notificationTimePatch('digestHourMinute', 1110)).toEqual({ digestHourMinute: 1110 })
  })
})

describe('notification preference saving', () => {
  it('keeps the previous value and reports one inline error when a save fails', async () => {
    const current = values({ socialReactions: true })
    const update = jest.fn(async () => {
      throw new Error('offline')
    })

    const result = await saveNotificationPreference({
      values: current,
      patch: notificationTogglePatch(current, 'socialReactions'),
      update,
    })

    expect(result).toEqual({
      status: 'failed',
      values: current,
      message: NOTIFICATION_SAVE_ERROR,
    })
    expect(NOTIFICATION_SAVE_ERROR).toBe('Notification preferences were not saved. Please try again.')
    expect(NOTIFICATION_SAVE_ERROR).not.toContain('—')
  })

  it('applies a confirmed patch without dropping other stored fields', () => {
    const current = values()

    expect(applyNotificationPreferencePatch(current, { quietHoursEnabled: true })).toEqual({
      ...current,
      quietHoursEnabled: true,
    })
  })
})

describe('notification preference time zone sync', () => {
  it('sends the device zone only when it differs from the stored zone', () => {
    expect(notificationTimeZonePatch(values({ timeZone: 'Asia/Manila' }), 'Asia/Manila')).toBeNull()
    expect(notificationTimeZonePatch(values({ timeZone: 'Asia/Manila' }), 'Europe/London')).toEqual({
      timeZone: 'Europe/London',
    })
    expect(notificationTimeZonePatch(values({ timeZone: 'Asia/Manila' }), '')).toBeNull()
  })

  it('syncs the UTC fallback when the device zone cannot be read', () => {
    const detected = resolveDeviceTimeZone(() => {
      throw new Error('Intl unavailable')
    })

    expect(detected).toBe('UTC')
    expect(notificationTimeZonePatch(values({ timeZone: 'Asia/Manila' }), detected)).toEqual({
      timeZone: 'UTC',
    })
    expect(notificationTimeZonePatch(values({ timeZone: 'UTC' }), detected)).toBeNull()
  })
})
