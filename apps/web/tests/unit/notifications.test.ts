import { describe, expect, it } from 'vitest'
import { formatNotificationTime, notificationSection, webDestination } from '../../src/lib/notifications'

describe('web notification helpers', () => {
  it('maps exact destinations without losing target IDs', () => {
    expect(webDestination({ type: 'post', postId: 'post-1' })).toEqual({ to: '/social', search: { postId: 'post-1' } })
    expect(webDestination({ type: 'post', postId: 'post-1', commentId: 'comment-1' })).toEqual({ to: '/social', search: { postId: 'post-1', commentId: 'comment-1' } })
    expect(webDestination({ type: 'conversation', conversationId: 'conversation-1', messageId: 'message-1' })).toEqual({ to: '/messages', search: { conversationId: 'conversation-1', messageId: 'message-1' } })
    expect(webDestination({ type: 'booking', audience: 'companion', bookingId: 'booking-1' })).toEqual({ to: '/companion', search: { bookingId: 'booking-1' } })
    expect(webDestination({ type: 'booking', audience: 'member', bookingId: 'booking-2' })).toEqual({ to: '/app', search: { bookingId: 'booking-2' } })
    expect(webDestination({ type: 'companion' })).toEqual({ to: '/companion', search: {} })
    expect(webDestination({ type: 'profile', userId: 'user-1' })).toEqual({ to: '/member-profile', search: { userId: 'user-1' } })
    expect(webDestination({ type: 'circle', circleId: 'circle-1', postId: 'post-2', commentId: 'comment-2' })).toEqual({
      to: '/circles/$circleId',
      params: { circleId: 'circle-1' },
      search: { postId: 'post-2', commentId: 'comment-2' },
    })
  })

  it('groups attention, new, and earlier items consistently', () => {
    const now = 2 * 24 * 60 * 60 * 1000
    expect(notificationSection({ priority: 'attention' }, now)).toBe('attention')
    expect(notificationSection({ priority: 'standard' }, now)).toBe('new')
    expect(notificationSection({ priority: 'standard', readAt: now - 2 * 24 * 60 * 60 * 1000 }, now)).toBe('earlier')
    expect(formatNotificationTime(now - 90 * 60 * 1000, now)).toBe('1h')
  })
})
