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
    expect(mobileNotificationRoute({ type: 'companion' })).toEqual({ pathname: '/companion' })
  })

  it('preserves post and profile IDs and routes safety updates to the Safety Center', () => {
    expect(mobileNotificationRoute({ type: 'post', postId: 'post-1' })).toEqual({ pathname: '/', params: { postId: 'post-1' } })
    expect(mobileNotificationRoute({ type: 'profile', userId: 'user-1' })).toEqual({ pathname: '/member-profile/[id]', params: { id: 'user-1' } })
    expect(mobileNotificationRoute({ type: 'safety' })).toEqual({ pathname: '/safety' })
    expect(mobileNotificationRoute({ type: 'notifications' })).toEqual({ pathname: '/notifications' })
  })

  it('opens Circle notifications at the private Circle destination', () => {
    expect(mobileNotificationRoute({ type: 'circle', circleId: 'circle-1' })).toEqual({ pathname: '/circles/[id]', params: { id: 'circle-1' } })
    expect(mobileNotificationRoute({ type: 'circle', circleId: 'circle-1', postId: 'post-1', commentId: 'comment-1' })).toEqual({
      pathname: '/circles/[id]',
      params: { id: 'circle-1', postId: 'post-1', commentId: 'comment-1' },
    })
  })

  it('opens Gathering notifications at the Gathering destination', () => {
    expect(mobileNotificationRoute({ type: 'gathering', gatheringId: 'gathering-1' })).toEqual({ pathname: '/gatherings/[id]', params: { id: 'gathering-1' } })
  })

  it('groups and ages notification rows consistently', () => {
    const now = 3 * 24 * 60 * 60 * 1000
    expect(notificationGroup({ priority: 'attention' }, now)).toBe('attention')
    expect(notificationGroup({ priority: 'standard' }, now)).toBe('new')
    expect(notificationGroup({ priority: 'standard', readAt: 1 }, now)).toBe('earlier')
    expect(notificationAge(now - 2 * 60 * 60 * 1000, now)).toBe('2h')
  })
})
