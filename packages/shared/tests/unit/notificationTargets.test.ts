import { describe, expect, it } from 'vitest'
import { circleNotificationTab } from '../../src/notificationTargets'

describe('Circle notification sections', () => {
  it('opens moderation queues only for moderators', () => {
    expect(circleNotificationTab('joinRequests', true)).toBe('members')
    expect(circleNotificationTab('pendingPosts', true)).toBe('pending')
    expect(circleNotificationTab('joinRequests', false)).toBe('discussions')
    expect(circleNotificationTab('pendingPosts', false)).toBe('discussions')
  })
  it('lets members inspect their role and host invitation', () => {
    expect(circleNotificationTab('members', false)).toBe('members')
    expect(circleNotificationTab('hostTransfer', false)).toBe('about')
  })
  it('falls back safely for missing or invalid sections', () => {
    expect(circleNotificationTab(undefined, true)).toBe('discussions')
    expect(circleNotificationTab('manage', true)).toBe('discussions')
  })
})
