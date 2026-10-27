import { describe, expect, it } from 'vitest'
import {
  isPostMuted,
  isTargetMuted,
  postMuteAnnouncement,
  postMuteLabel,
  type NotificationMuteRow,
} from '../../src/features/social/notificationMutes'

const rows: NotificationMuteRow[] = [
  { targetType: 'post', targetId: 'post-1', createdAt: 1 },
  { targetType: 'circle', targetId: 'circle-1', createdAt: 2 },
  { targetType: 'circle', targetId: 'post-2', createdAt: 3 },
]

describe('post notification mute state', () => {
  it('derives mute state for one post from the member mute rows', () => {
    expect(isPostMuted(rows, 'post-1')).toBe(true)
    expect(isPostMuted(rows, 'post-2')).toBe(false)
    expect(isPostMuted(rows, 'post-3')).toBe(false)
    expect(isPostMuted(undefined, 'post-1')).toBe(false)
    expect(isPostMuted([], 'post-1')).toBe(false)
  })

  it('keeps Circle mutes separate from post mutes', () => {
    expect(isTargetMuted(rows, 'circle', 'circle-1')).toBe(true)
    expect(isTargetMuted(rows, 'post', 'circle-1')).toBe(false)
  })

  it('labels the post mute action and announcement by state', () => {
    expect(postMuteLabel(false)).toBe('Mute notifications for this post')
    expect(postMuteLabel(true)).toBe('Unmute notifications for this post')
    expect(postMuteAnnouncement(true)).toBe('Notifications muted for this post.')
    expect(postMuteAnnouncement(false)).toBe('Notifications unmuted for this post.')
  })
})
