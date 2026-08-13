import { describe, expect, it } from 'vitest'
import { formatNotificationTime, notificationSection, webDestination } from './notifications'

describe('web notification helpers', () => {
  it('maps exact destinations without losing target IDs', () => {
    expect(webDestination({ type: 'post', postId: 'post-1' })).toEqual({ to: '/social', search: { postId: 'post-1' } })
    expect(webDestination({ type: 'booking', audience: 'companion', bookingId: 'booking-1' })).toEqual({ to: '/companion', search: { bookingId: 'booking-1' } })
    expect(webDestination({ type: 'booking', audience: 'member', bookingId: 'booking-2' })).toEqual({ to: '/app', search: { bookingId: 'booking-2' } })
    expect(webDestination({ type: 'companion' })).toEqual({ to: '/companion', search: {} })
  })

  it('groups attention, new, and earlier items consistently', () => {
    const now = 2 * 24 * 60 * 60 * 1000
    expect(notificationSection({ priority: 'attention' }, now)).toBe('attention')
    expect(notificationSection({ priority: 'standard' }, now)).toBe('new')
    expect(notificationSection({ priority: 'standard', readAt: now - 2 * 24 * 60 * 60 * 1000 }, now)).toBe('earlier')
    expect(formatNotificationTime(now - 90 * 60 * 1000, now)).toBe('1h')
  })
})
