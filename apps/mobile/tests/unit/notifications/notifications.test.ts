import { mobileNotificationRoute, notificationAge, notificationGroup, notificationInitials, notificationReadAction, notificationVisualIcon } from '@/data/notifications'

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

describe('notification visual icons', () => {
  it('names the reason for each social, booking, account, and safety notification', () => {
    expect(notificationVisualIcon('post_liked')).toBe('heart')
    expect(notificationVisualIcon('comment_liked')).toBe('heart')
    expect(notificationVisualIcon('direct_message')).toBe('chatbubble')
    expect(notificationVisualIcon('post_commented')).toBe('chatbubble-ellipses')
    expect(notificationVisualIcon('new_follower')).toBe('person-add')
    expect(notificationVisualIcon('booking_accepted')).toBe('calendar-outline')
    expect(notificationVisualIcon('review_received')).toBe('star')
    expect(notificationVisualIcon('identity_verification_approved')).toBe('shield-checkmark')
    expect(notificationVisualIcon('report_resolved')).toBe('flag')
    expect(notificationVisualIcon('referral_credit')).toBe('gift')
    expect(notificationVisualIcon('circle_join_requested')).toBe('people')
  })

  it('falls back to a neutral bell for unknown or missing kinds', () => {
    expect(notificationVisualIcon()).toBe('notifications')
    expect(notificationVisualIcon('social_digest')).toBe('notifications')
    expect(notificationVisualIcon('something_new')).toBe('notifications')
  })
})

describe('notification actor initials', () => {
  it('keeps members without a photo distinguishable in an aggregate stack', () => {
    expect(notificationInitials('Alex Rivera')).toBe('AR')
    expect(notificationInitials('  priya   shah ')).toBe('PS')
    expect(notificationInitials('Mateo')).toBe('M')
    expect(notificationInitials('')).toBe('')
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
