import {
  isPostMuted,
  POST_MUTE_LABEL,
  POST_MUTED_TOAST,
  POST_MUTE_ERROR,
  POST_UNMUTE_LABEL,
  POST_UNMUTED_TOAST,
  postMuteActionLabel,
  postMuteToastMessage,
  type NotificationMuteRow,
} from '@/notifications/notificationMutes'

describe('post notification mute derivation', () => {
  it('marks only the matching post as muted', () => {
    const mutes: NotificationMuteRow[] = [
      { targetType: 'post', targetId: 'post-a' },
      { targetType: 'circle', targetId: 'post-b' },
    ]

    expect(isPostMuted(mutes, 'post-a')).toBe(true)
    expect(isPostMuted(mutes, 'post-b')).toBe(false)
    expect(isPostMuted(mutes, 'post-c')).toBe(false)
  })

  it('treats a loading or empty mute list as unmuted', () => {
    expect(isPostMuted(undefined, 'post-a')).toBe(false)
    expect(isPostMuted(null, 'post-a')).toBe(false)
    expect(isPostMuted([], 'post-a')).toBe(false)
    expect(isPostMuted([{ targetType: 'post', targetId: 'post-a' }], '')).toBe(false)
  })
})

describe('post notification mute copy', () => {
  it('offers the matching mute or unmute action', () => {
    expect(postMuteActionLabel(false)).toBe(POST_MUTE_LABEL)
    expect(postMuteActionLabel(true)).toBe(POST_UNMUTE_LABEL)
    expect(POST_MUTE_LABEL).toBe('Mute notifications for this post')
    expect(POST_UNMUTE_LABEL).toBe('Unmute notifications for this post')
  })

  it('confirms muting and unmuting with distinct toasts', () => {
    expect(postMuteToastMessage(true)).toBe(POST_MUTED_TOAST)
    expect(postMuteToastMessage(false)).toBe(POST_UNMUTED_TOAST)
    expect(POST_MUTED_TOAST).toBe('Notifications muted for this post.')
    expect(POST_UNMUTED_TOAST).toBe('Notifications turned back on for this post.')
  })

  it('uses no em dashes in user facing mute copy', () => {
    for (const copy of [POST_MUTE_LABEL, POST_UNMUTE_LABEL, POST_MUTED_TOAST, POST_UNMUTED_TOAST, POST_MUTE_ERROR]) {
      expect(copy).not.toContain('—')
    }
  })
})
