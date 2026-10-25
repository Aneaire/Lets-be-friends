import { SocialPostCard, type SocialPostView } from '@/features/social/SocialPostCard'
import type { PostViewerImage } from '@/features/social/PostImageViewer'

export function CompanionProfilePostList({ posts, signedIn, following, followBusy = false, onToggleFollow, onOpenImage }: {
  posts: SocialPostView[]
  signedIn: boolean
  following: boolean
  followBusy?: boolean
  onToggleFollow?: (authorId: string) => Promise<boolean | undefined>
  onOpenImage: (image: PostViewerImage) => void
}) {
  return (
    <>
      {posts.map((post) => (
        <SocialPostCard
          key={String(post._id)}
          post={post}
          signedIn={signedIn}
          following={following}
          followBusy={followBusy}
          onToggleFollow={onToggleFollow}
          onOpenImage={onOpenImage}
          onAction={() => undefined}
        />
      ))}
    </>
  )
}
