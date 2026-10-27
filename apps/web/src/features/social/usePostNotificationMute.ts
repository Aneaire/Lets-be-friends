import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { isPostMuted } from './notificationMutes'

/**
 * Reads the member's mute rows once per surface and flips a single post. Muting
 * a post only affects the viewer, so it never changes anyone else's feed.
 */
export function usePostNotificationMute(enabled: boolean) {
  const rows = useQuery(api.notificationMutes.mine, enabled ? {} : 'skip')
  const setMuted = useMutation(api.notificationMutes.setMuted)

  return {
    isPostMuted: (postId: string) => isPostMuted(rows, postId),
    togglePostMute: async (postId: string) => {
      if (!enabled) return
      await setMuted({ targetType: 'post', targetId: postId, muted: !isPostMuted(rows, postId) })
    },
  }
}
