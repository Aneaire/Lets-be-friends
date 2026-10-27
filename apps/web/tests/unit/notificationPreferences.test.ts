import { describe, expect, it } from 'vitest'
import {
  isNotificationCategoryEnabled,
  isNotificationKindEnabled,
  isWithinQuietHours,
  localDateKey,
  localHour,
  localMinuteOfDay,
  NOTIFICATION_PREFERENCE_DEFAULTS,
  notificationKindCategory,
  resolveStoredNotificationPreferences,
  shouldSuppressNotificationPush,
} from '../../convex/notificationPreferences'

describe('notification preference helpers', () => {
  it('resolves defaults for a member with no stored row', () => {
    expect(resolveStoredNotificationPreferences(null)).toEqual({
      socialReactions: true,
      socialComments: true,
      socialFollows: true,
      circleActivity: true,
      quietHoursEnabled: false,
      quietHoursStartMinute: 1320,
      quietHoursEndMinute: 420,
      timeZone: 'UTC',
      digestEnabled: false,
      digestHourMinute: 1080,
    })
    expect(resolveStoredNotificationPreferences(null)).toEqual(NOTIFICATION_PREFERENCE_DEFAULTS)
  })

  it('keeps stored values while filling omitted fields with defaults', () => {
    expect(resolveStoredNotificationPreferences({
      socialReactions: false,
      quietHoursEnabled: true,
      quietHoursStartMinute: 1200,
      quietHoursEndMinute: 480,
      timeZone: 'Asia/Manila',
    })).toMatchObject({
      socialReactions: false,
      socialComments: true,
      socialFollows: true,
      circleActivity: true,
      quietHoursEnabled: true,
      quietHoursStartMinute: 1200,
      quietHoursEndMinute: 480,
      timeZone: 'Asia/Manila',
      digestEnabled: false,
      digestHourMinute: 1080,
    })
  })

  it('maps social and Circle kinds to their controlling category', () => {
    for (const kind of ['post_liked', 'comment_liked', 'review_liked', 'circle_reaction', 'circle_comment_liked'] as const) {
      expect(notificationKindCategory(kind)).toBe('reactions')
    }
    for (const kind of ['post_commented', 'comment_reply', 'mention', 'review_commented', 'circle_reply', 'circle_mention'] as const) {
      expect(notificationKindCategory(kind)).toBe('comments')
    }
    expect(notificationKindCategory('new_follower')).toBe('follows')
    expect(notificationKindCategory('circle_announcement')).toBe('circle')
  })

  it('returns no category for messages, bookings, safety, identity, and system digests', () => {
    for (const kind of [
      'direct_message',
      'booking_request',
      'booking_accepted',
      'booking_reminder',
      'booking_review_window_opened',
      'identity_verification_approved',
      'report_resolved',
      'circle_join_requested',
      'circle_join_rejected',
      'circle_member_removed',
      'review_received',
      'social_digest',
    ] as const) {
      expect(notificationKindCategory(kind)).toBeNull()
    }
  })

  it('reads each category toggle independently', () => {
    const preferences = {
      ...NOTIFICATION_PREFERENCE_DEFAULTS,
      socialReactions: false,
      socialComments: true,
      socialFollows: false,
      circleActivity: true,
    }
    expect(isNotificationCategoryEnabled(preferences, 'reactions')).toBe(false)
    expect(isNotificationCategoryEnabled(preferences, 'comments')).toBe(true)
    expect(isNotificationCategoryEnabled(preferences, 'follows')).toBe(false)
    expect(isNotificationCategoryEnabled(preferences, 'circle')).toBe(true)
  })

  it('requires the Circle activity toggle as well as the kind category', () => {
    const withCircleOff = { ...NOTIFICATION_PREFERENCE_DEFAULTS, circleActivity: false }
    expect(isNotificationKindEnabled(withCircleOff, 'circle_reply')).toBe(false)
    expect(isNotificationKindEnabled(withCircleOff, 'circle_reaction')).toBe(false)
    expect(isNotificationKindEnabled(withCircleOff, 'post_liked')).toBe(true)
    expect(isNotificationKindEnabled(withCircleOff, 'direct_message')).toBe(true)

    const withReactionsOff = { ...NOTIFICATION_PREFERENCE_DEFAULTS, socialReactions: false }
    expect(isNotificationKindEnabled(withReactionsOff, 'circle_reaction')).toBe(false)
    expect(isNotificationKindEnabled(withReactionsOff, 'circle_reply')).toBe(true)
  })

  it('never suppresses booking, message, safety, or Circle management kinds', () => {
    const allOff = {
      ...NOTIFICATION_PREFERENCE_DEFAULTS,
      socialReactions: false,
      socialComments: false,
      socialFollows: false,
      circleActivity: false,
    }
    for (const kind of ['booking_request', 'booking_reminder', 'direct_message', 'report_resolved', 'circle_join_requested', 'circle_announcement', 'social_digest'] as const) {
      expect(isNotificationKindEnabled(allOff, kind)).toBe(true)
    }
  })

  it('treats quiet hours as a half-open window inside one day', () => {
    const at = (hour: number, minute = 0) => Date.UTC(2026, 9, 27, hour, minute)
    expect(isWithinQuietHours(at(22), 1320, 420, 'UTC')).toBe(true)
    expect(isWithinQuietHours(at(23, 30), 1320, 420, 'UTC')).toBe(true)
    expect(isWithinQuietHours(at(0, 15), 1320, 420, 'UTC')).toBe(true)
    expect(isWithinQuietHours(at(6, 59), 1320, 420, 'UTC')).toBe(true)
    expect(isWithinQuietHours(at(7), 1320, 420, 'UTC')).toBe(false)
    expect(isWithinQuietHours(at(12), 1320, 420, 'UTC')).toBe(false)
    expect(isWithinQuietHours(at(12), 540, 1020, 'UTC')).toBe(true)
    expect(isWithinQuietHours(at(17), 540, 1020, 'UTC')).toBe(false)
    expect(isWithinQuietHours(at(12), 600, 600, 'UTC')).toBe(false)
  })

  it('converts quiet hours through the member time zone, including a half-hour offset', () => {
    const instant = Date.UTC(2026, 9, 27, 18, 20)
    expect(localMinuteOfDay(instant, 'UTC')).toBe(18 * 60 + 20)
    // 18:20 UTC is 23:50 in Asia/Kolkata, so the midnight-crossing window applies.
    expect(localMinuteOfDay(instant, 'Asia/Kolkata')).toBe(23 * 60 + 50)
    expect(isWithinQuietHours(instant, 1320, 420, 'Asia/Kolkata')).toBe(true)
    expect(isWithinQuietHours(instant, 1320, 420, 'UTC')).toBe(false)
  })

  it('converts local time across a daylight-saving change instead of using a fixed offset', () => {
    const beforeSpringForward = Date.UTC(2026, 2, 8, 6, 59)
    const afterSpringForward = Date.UTC(2026, 2, 8, 7, 1)
    expect(localMinuteOfDay(beforeSpringForward, 'America/New_York')).toBe(1 * 60 + 59)
    expect(localMinuteOfDay(afterSpringForward, 'America/New_York')).toBe(3 * 60 + 1)
    // The repeated hour in November still resolves to the same local clock time.
    expect(localMinuteOfDay(Date.UTC(2026, 10, 1, 5, 30), 'America/New_York')).toBe(1 * 60 + 30)
    expect(localMinuteOfDay(Date.UTC(2026, 10, 1, 6, 30), 'America/New_York')).toBe(1 * 60 + 30)
  })

  it('keys a local day and digest hour from the member time zone', () => {
    const instant = Date.UTC(2026, 9, 27, 20, 0)
    expect(localDateKey(instant, 'UTC')).toBe('2026-10-27')
    expect(localDateKey(instant, 'Asia/Kolkata')).toBe('2026-10-28')
    expect(localHour(instant, 'Asia/Kolkata')).toBe(1)
    expect(localHour(Date.UTC(2026, 9, 27, 18, 20), 'Asia/Kolkata')).toBe(23)
  })

  it('suppresses only social and Circle pushes for quiet hours and the digest', () => {
    const quiet = {
      ...NOTIFICATION_PREFERENCE_DEFAULTS,
      quietHoursEnabled: true,
      quietHoursStartMinute: 1320,
      quietHoursEndMinute: 420,
    }
    const night = Date.UTC(2026, 9, 27, 23, 0)
    const noon = Date.UTC(2026, 9, 27, 12, 0)
    expect(shouldSuppressNotificationPush(quiet, 'post_liked', night)).toBe(true)
    expect(shouldSuppressNotificationPush(quiet, 'circle_reply', night)).toBe(true)
    expect(shouldSuppressNotificationPush(quiet, 'post_liked', noon)).toBe(false)
    expect(shouldSuppressNotificationPush(quiet, 'booking_accepted', night)).toBe(false)
    expect(shouldSuppressNotificationPush(quiet, 'direct_message', night)).toBe(false)
    expect(shouldSuppressNotificationPush(quiet, 'identity_verification_expired', night)).toBe(false)

    const digest = { ...NOTIFICATION_PREFERENCE_DEFAULTS, digestEnabled: true }
    expect(shouldSuppressNotificationPush(digest, 'post_liked', noon)).toBe(true)
    expect(shouldSuppressNotificationPush(digest, 'new_follower', noon)).toBe(true)
    expect(shouldSuppressNotificationPush(digest, 'social_digest', noon)).toBe(false)
    expect(shouldSuppressNotificationPush(digest, 'booking_accepted', noon)).toBe(false)
  })
})
