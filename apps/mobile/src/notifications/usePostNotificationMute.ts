import { useMutation, useQuery } from 'convex/react'

import { mobileApi } from '@/backend/client'

import { isPostMuted } from './notificationMutes'

/**
 * Reads the viewer's mute list once per card. Convex caches the identical
 * query for every mounted card, so this stays a single subscription and the
 * derived flag never triggers an extra fetch. Signed-out cards skip the
 * account-only query entirely.
 */
export function usePostNotificationMute(postId: string, enabled: boolean) {
  const mutes = useQuery(mobileApi.notificationMutes.mine, enabled ? {} : 'skip')
  const setMuted = useMutation(mobileApi.notificationMutes.setMuted)

  return {
    muted: isPostMuted(mutes, postId),
    setMuted: (muted: boolean) => setMuted({ targetType: 'post', targetId: postId, muted }),
  }
}
