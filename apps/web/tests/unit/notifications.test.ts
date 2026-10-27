import { describe, expect, it } from 'vitest'
import { formatNotificationTime, notificationSection, webDestination } from '../../src/lib/notifications'

describe('web notification helpers', () => {
  it('maps exact destinations without losing target IDs', () => {
    expect(webDestination({ type: 'post', postId: 'post-1' })).toEqual({ to: '/social', search: { postId: 'post-1' } })
    expect(webDestination({ type: 'post', postId: 'post-1', commentId: 'comment-1' })).toEqual({ to: '/social', search: { postId: 'post-1', commentId: 'comment-1' } })
    expect(webDestination({ type: 'conversation', conversationId: 'conversation-1', messageId: 'message-1' })).toEqual({ to: '/messages', search: { conversationId: 'conversation-1', messageId: 'message-1' } })
    expect(webDestination({ type: 'companion' })).toEqual({ to: '/companion', search: {} })
    expect(webDestination({ type: 'identity', outcome: 'verified' })).toEqual({ to: '/verified', search: {} })
    expect(webDestination({ type: 'identity', outcome: 'status' })).toEqual({ to: '/profile', search: {} })
    expect(webDestination({ type: 'profile', userId: 'user-1' })).toEqual({ to: '/member-profile', search: { userId: 'user-1' } })
    expect(webDestination({ type: 'circle', circleId: 'circle-1', postId: 'post-2', commentId: 'comment-2' })).toEqual({
      to: '/circles/$circleId',
      params: { circleId: 'circle-1' },
      search: { postId: 'post-2', commentId: 'comment-2' },
    })
    expect(webDestination({ type: 'circle', circleId: 'circle-1', section: 'joinRequests' })).toEqual({
      to: '/circles/$circleId',
      params: { circleId: 'circle-1' },
      search: { section: 'joinRequests' },
    })
    expect(webDestination({ type: 'review', reviewId: 'review-1', companionProfileId: 'companion-1', commentId: 'comment-3' })).toEqual({
      to: '/companion-profile',
      search: { companionProfileId: 'companion-1', reviewId: 'review-1', commentId: 'comment-3' },
    })
    expect(webDestination({ type: 'review', reviewId: 'review-1', bookingId: 'booking-3' })).toEqual({
      to: '/app',
      search: { bookingId: 'booking-3' },
    })
  })

  it('opens booking notifications on the home workspace for both perspectives', () => {
    // A Companion used to land on the Companion tools page, which dropped the
    // booking details dialog on top of a profile editor. The home workspace owns
    // that dialog and also lists the Companion side under Bookings as Companion.
    expect(webDestination({ type: 'booking', audience: 'companion', bookingId: 'booking-1' })).toEqual({ to: '/app', search: { bookingId: 'booking-1' } })
    expect(webDestination({ type: 'booking', audience: 'member', bookingId: 'booking-2' })).toEqual({ to: '/app', search: { bookingId: 'booking-2' } })
  })

  it('groups attention, new, and earlier items consistently', () => {
    const now = 2 * 24 * 60 * 60 * 1000
    expect(notificationSection({ priority: 'attention' }, now)).toBe('attention')
    expect(notificationSection({ priority: 'standard' }, now)).toBe('new')
    expect(notificationSection({ priority: 'standard', readAt: now - 2 * 24 * 60 * 60 * 1000 }, now)).toBe('earlier')
    expect(formatNotificationTime(now - 90 * 60 * 1000, now)).toBe('1h')
  })
})
