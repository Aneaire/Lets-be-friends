/** Notification mute helpers for a single post target. */

export type NotificationTargetType = 'post' | 'circle'

export type NotificationMuteRow = {
  targetType: NotificationTargetType
  targetId: string
}

export const POST_MUTE_LABEL = 'Mute notifications for this post'
export const POST_UNMUTE_LABEL = 'Unmute notifications for this post'
export const POST_MUTED_TOAST = 'Notifications muted for this post.'
export const POST_UNMUTED_TOAST = 'Notifications turned back on for this post.'
export const POST_MUTE_ERROR = 'Notifications could not be updated for this post.'

/** Derives mute state for one post from the viewer's mute list. */
export function isPostMuted(
  mutes: ReadonlyArray<NotificationMuteRow> | null | undefined,
  postId: string,
): boolean {
  if (!mutes || !postId) return false
  return mutes.some((row) => row.targetType === 'post' && row.targetId === postId)
}

export function postMuteActionLabel(muted: boolean): string {
  return muted ? POST_UNMUTE_LABEL : POST_MUTE_LABEL
}

export function postMuteToastMessage(muted: boolean): string {
  return muted ? POST_MUTED_TOAST : POST_UNMUTED_TOAST
}
