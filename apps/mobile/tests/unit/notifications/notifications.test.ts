import { mobileNotificationRoute, notificationAge, notificationGroup, notificationReadAction } from '@/data/notifications'

describe('notification read action', () => {
  it('offers mark as read for an unread notification', () => {
    expect(notificationReadAction(true)).toEqual({
      label: 'Mark as read',
      icon: 'checkmark-circle-outline',
    })
  })

  it('offers mark as unread for a read notification', () => {
    expect(notificationReadAction(false)).toEqual({
      label: 'Mark as unread',
      icon: 'mail-unread-outline',
    })
  })
})

describe('mobile notification helpers', () => {
  it('dispatches to existing booking and conversation screens', () => {
    expect(mobileNotificationRoute({ type: 'booking', audience: 'member', bookingId: 'booking-1' })).toEqual({ pathname: '/booking/[id]', params: { id: 'booking-1' } })
    expect(mobileNotificationRoute({ type: 'booking', audience: 'companion', bookingId: 'booking-2' })).toEqual({ pathname: '/companion-booking/[id]', params: { id: 'booking-2' } })
    expect(mobileNotificationRoute({ type: 'conversation', conversationId: 'conversation-1' })).toEqual({ pathname: '/conversation/[id]', params: { id: 'conversation-1' } })
    expect(mobileNotificationRoute({ type: 'conversation', conversationId: 'conversation-1', messageId: 'message-1' })).toEqual({ pathname: '/conversation/[id]', params: { id: 'conversation-1', messageId: 'message-1' } })
    expect(mobileNotificationRoute({ type: 'companion' })).toEqual({ pathname: '/companion' })
  })

  it('opens a review on its Companion profile and falls back to the booking', () => {
    expect(mobileNotificationRoute({ type: 'review', reviewId: 'review-1', companionProfileId: 'companion-1', commentId: 'comment-1' })).toEqual({
      pathname: '/companion-profile/[id]',
      params: { id: 'companion-1', reviewId: 'review-1', commentId: 'comment-1' },
    })
    expect(mobileNotificationRoute({ type: 'review', reviewId: 'review-1', bookingId: 'booking-1' })).toEqual({
      pathname: '/booking/[id]',
      params: { id: 'booking-1' },
    })
  })

  it('opens the Circle management section from a notification', () => {
    expect(mobileNotificationRoute({ type: 'circle', circleId: 'circle-1', section: 'joinRequests' })).toEqual({
      pathname: '/circles/[id]',
      params: { id: 'circle-1', section: 'joinRequests' },
    })
  })

  it('opens an approved identity notification on the congratulations screen', () => {
    expect(mobileNotificationRoute({ type: 'identity', outcome: 'verified' })).toEqual({ pathname: '/verified' })
  })

  it('keeps every other identity notification on Get verified', () => {
    expect(mobileNotificationRoute({ type: 'identity', outcome: 'status' })).toEqual({ pathname: '/get-verified' })
  })

  it('preserves post and profile IDs and routes safety updates to the Safety Center', () => {
    expect(mobileNotificationRoute({ type: 'post', postId: 'post-1' })).toEqual({ pathname: '/', params: { postId: 'post-1' } })
    expect(mobileNotificationRoute({ type: 'profile', userId: 'user-1' })).toEqual({ pathname: '/member-profile/[id]', params: { id: 'user-1' } })
    expect(mobileNotificationRoute({ type: 'safety' })).toEqual({ pathname: '/safety' })
    expect(mobileNotificationRoute({ type: 'notifications' })).toEqual({ pathname: '/notifications' })
  })

  it('opens a commented post on the comment thread so the comment can be anchored', () => {
    expect(mobileNotificationRoute({ type: 'post', postId: 'post-1', commentId: 'comment-1' })).toEqual({
      pathname: '/post-comments/[id]',
      params: { id: 'post-1', commentId: 'comment-1' },
    })
  })

  it('opens Circle notifications at the private Circle destination', () => {
    expect(mobileNotificationRoute({ type: 'circle', circleId: 'circle-1' })).toEqual({ pathname: '/circles/[id]', params: { id: 'circle-1' } })
    expect(mobileNotificationRoute({ type: 'circle', circleId: 'circle-1', postId: 'post-1', commentId: 'comment-1' })).toEqual({
      pathname: '/circles/[id]',
      params: { id: 'circle-1', postId: 'post-1', commentId: 'comment-1' },
    })
  })

  it('groups and ages notification rows consistently', () => {
    const now = 3 * 24 * 60 * 60 * 1000
    expect(notificationGroup({ priority: 'attention' }, now)).toBe('attention')
    expect(notificationGroup({ priority: 'standard' }, now)).toBe('new')
    expect(notificationGroup({ priority: 'standard', readAt: 1 }, now)).toBe('earlier')
    expect(notificationAge(now - 2 * 60 * 60 * 1000, now)).toBe('2h')
  })
})

it('preserves Circle management sections and exact review comment targets', () => {
  expect(mobileNotificationRoute({ type: 'circle', circleId: 'circle-1', section: 'pendingPosts' })).toEqual({ pathname: '/circles/[id]', params: { id: 'circle-1', section: 'pendingPosts' } })
  expect(mobileNotificationRoute({ type: 'review', reviewId: 'review-1', companionProfileId: 'companion-1', commentId: 'comment-1' })).toEqual({ pathname: '/companion-profile/[id]', params: { id: 'companion-1', reviewId: 'review-1', commentId: 'comment-1' } })
})
