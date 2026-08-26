import type { PostId } from '@/backend/client'

export function postCommentsRoute(postId: PostId | string) {
  return {
    pathname: '/post-comments/[id]' as const,
    params: { id: String(postId) },
  }
}
