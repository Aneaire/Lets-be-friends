export type NotificationMuteTargetType = 'post' | 'circle'

export type NotificationMuteRow = {
  targetType: NotificationMuteTargetType
  targetId: string
  createdAt: number
}

/** Derives mute state from the member's mute rows for one target. */
export function isTargetMuted(
  rows: readonly NotificationMuteRow[] | undefined | null,
  targetType: NotificationMuteTargetType,
  targetId: string,
): boolean {
  if (!rows) return false
  return rows.some((row) => row.targetType === targetType && row.targetId === targetId)
}

export function isPostMuted(rows: readonly NotificationMuteRow[] | undefined | null, postId: string): boolean {
  return isTargetMuted(rows, 'post', postId)
}

export function postMuteLabel(muted: boolean): string {
  return muted ? 'Unmute notifications for this post' : 'Mute notifications for this post'
}

export function postMuteAnnouncement(muted: boolean): string {
  return muted ? 'Notifications muted for this post.' : 'Notifications unmuted for this post.'
}
