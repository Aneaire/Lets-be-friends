import { formatMinuteLabel, normalizeMinuteOfDay } from './preferenceTime'

/** Mirrors api.notificationPreferences.mine, where every field is always present. */
export type NotificationPreferenceValues = {
  socialReactions: boolean
  socialComments: boolean
  socialFollows: boolean
  circleActivity: boolean
  quietHoursEnabled: boolean
  quietHoursStartMinute: number
  quietHoursEndMinute: number
  timeZone: string
  digestEnabled: boolean
  digestHourMinute: number
}

export type NotificationToggleField =
  | 'socialReactions'
  | 'socialComments'
  | 'socialFollows'
  | 'circleActivity'
  | 'quietHoursEnabled'
  | 'digestEnabled'

export type NotificationTimeField =
  | 'quietHoursStartMinute'
  | 'quietHoursEndMinute'
  | 'digestHourMinute'

export type NotificationPreferencePatch = Partial<NotificationPreferenceValues>

export const NOTIFICATION_SAVE_SUCCESS = 'Notification preferences saved.'
export const NOTIFICATION_SAVE_ERROR = 'Notification preferences were not saved. Please try again.'

export const NOTIFICATION_CATEGORY_TOGGLES: ReadonlyArray<{
  field: NotificationToggleField
  label: string
  detail: string
}> = [
  {
    field: 'socialReactions',
    label: 'Reactions',
    detail: 'Post likes, comment likes, and review likes',
  },
  {
    field: 'socialComments',
    label: 'Comments and replies',
    detail: 'Comments, replies, and mentions on your posts',
  },
  {
    field: 'socialFollows',
    label: 'New followers',
    detail: 'Members who start following you',
  },
  {
    field: 'circleActivity',
    label: 'Circle activity',
    detail: 'Updates from Circles you belong to',
  },
]

export const QUIET_HOURS_TOGGLE = {
  field: 'quietHoursEnabled' as const,
  label: 'Quiet hours',
  detail: 'Hold social notifications during a daily window',
}

export const DIGEST_TOGGLE = {
  field: 'digestEnabled' as const,
  label: 'Daily digest',
  detail: 'Collect social updates into one message',
}

export type NotificationToggleRow = {
  field: NotificationToggleField
  label: string
  detail: string
  checked: boolean
  busy: boolean
  disabled: boolean
}

export type NotificationTimeRow = {
  field: NotificationTimeField
  label: string
  minute: number
  timeLabel: string
  accessibilityLabel: string
  busy: boolean
  disabled: boolean
}

function toggleRow(
  toggle: { field: NotificationToggleField; label: string; detail: string },
  values: NotificationPreferenceValues,
  savingField: NotificationToggleField | NotificationTimeField | null,
): NotificationToggleRow {
  return {
    field: toggle.field,
    label: toggle.label,
    detail: toggle.detail,
    checked: values[toggle.field],
    busy: savingField === toggle.field,
    disabled: savingField !== null,
  }
}

export function notificationToggleRows(
  values: NotificationPreferenceValues,
  savingField: NotificationToggleField | NotificationTimeField | null = null,
): NotificationToggleRow[] {
  return [
    ...NOTIFICATION_CATEGORY_TOGGLES.map((toggle) => toggleRow(toggle, values, savingField)),
    toggleRow(QUIET_HOURS_TOGGLE, values, savingField),
    toggleRow(DIGEST_TOGGLE, values, savingField),
  ]
}

/** Quiet hours rows only exist while the window is on. */
export function quietHoursTimeRows(
  values: NotificationPreferenceValues,
  savingField: NotificationToggleField | NotificationTimeField | null = null,
): [NotificationTimeRow, NotificationTimeRow] | null {
  if (!values.quietHoursEnabled) return null
  const row = (field: NotificationTimeField, label: string, spoken: string, minute: number): NotificationTimeRow => ({
    field,
    label,
    minute,
    timeLabel: formatMinuteLabel(minute),
    accessibilityLabel: `${spoken}, ${formatMinuteLabel(minute)}`,
    busy: savingField === field,
    disabled: savingField !== null,
  })
  return [
    row('quietHoursStartMinute', 'From', 'Quiet hours start', values.quietHoursStartMinute),
    row('quietHoursEndMinute', 'To', 'Quiet hours end', values.quietHoursEndMinute),
  ]
}

/** The digest time row only exists while the digest is on. */
export function digestTimeRow(
  values: NotificationPreferenceValues,
  savingField: NotificationToggleField | NotificationTimeField | null = null,
): NotificationTimeRow | null {
  if (!values.digestEnabled) return null
  return {
    field: 'digestHourMinute',
    label: 'Send at',
    minute: values.digestHourMinute,
    timeLabel: formatMinuteLabel(values.digestHourMinute),
    accessibilityLabel: `Daily digest time, ${formatMinuteLabel(values.digestHourMinute)}`,
    busy: savingField === 'digestHourMinute',
    disabled: savingField !== null,
  }
}

/** The exact partial payload a toggle press sends to update. */
export function notificationTogglePatch(
  values: NotificationPreferenceValues,
  field: NotificationToggleField,
): NotificationPreferencePatch {
  return { [field]: !values[field] } as NotificationPreferencePatch
}

/** The exact partial payload a picker selection sends to update. */
export function notificationTimePatch(
  field: NotificationTimeField,
  minute: number,
): NotificationPreferencePatch {
  return { [field]: normalizeMinuteOfDay(minute) } as NotificationPreferencePatch
}

/**
 * The first load sends the device zone only when it differs from the stored
 * one, so the quiet hours window is judged in the member's real local time.
 */
export function notificationTimeZonePatch(
  values: Pick<NotificationPreferenceValues, 'timeZone'>,
  deviceTimeZone: string,
): NotificationPreferencePatch | null {
  if (!deviceTimeZone || deviceTimeZone === values.timeZone) return null
  return { timeZone: deviceTimeZone }
}

export function applyNotificationPreferencePatch(
  values: NotificationPreferenceValues,
  patch: NotificationPreferencePatch,
): NotificationPreferenceValues {
  return { ...values, ...patch }
}

export type NotificationPreferenceSaveResult =
  | { status: 'saved'; values: NotificationPreferenceValues }
  | { status: 'failed'; values: NotificationPreferenceValues; message: string }

/**
 * Applies one patch and reports the state to keep. A rejected update returns
 * the previous values unchanged so the control falls back to what was stored.
 */
export async function saveNotificationPreference({
  values,
  patch,
  update,
}: {
  values: NotificationPreferenceValues
  patch: NotificationPreferencePatch
  update: (patch: NotificationPreferencePatch) => Promise<unknown>
}): Promise<NotificationPreferenceSaveResult> {
  try {
    await update(patch)
    return { status: 'saved', values: applyNotificationPreferencePatch(values, patch) }
  } catch {
    return { status: 'failed', values, message: NOTIFICATION_SAVE_ERROR }
  }
}
