import type { StoredMention } from '@lets-be-friends/shared'
import { StyleSheet, View } from 'react-native'

import { MentionBody } from './MentionBody'
import { PostMediaGrid, type DisplayPostMediaItem } from './PostMediaGrid'
import { PollCard, type MobilePoll } from './PollCard'
import { FeaturedCommentPreview, type FeaturedComment } from './FeaturedCommentPreview'
import type { PostImagePressContext } from './postImagePresentation'

export function PostContent({
  body,
  mentions,
  media = [],
  poll,
  featuredComment,
  disabled = false,
  imagePressContext = 'feed',
  onOpenImage,
  onOpenVideo,
  onVote,
  onOpenFeaturedThread,
}: {
  body?: string
  mentions?: StoredMention[]
  media?: DisplayPostMediaItem[]
  poll?: MobilePoll | null
  featuredComment?: FeaturedComment | null
  disabled?: boolean
  imagePressContext?: PostImagePressContext
  onOpenImage?: (item: DisplayPostMediaItem & { url: string }, index: number, total: number) => void
  onOpenVideo: (url: string) => void
  onVote?: (optionId: string) => Promise<void>
  onOpenFeaturedThread?: () => void
}) {
  return (
    <View style={styles.content}>
      {body ? <MentionBody body={body} mentions={mentions} /> : null}
      <PostMediaGrid
        media={media}
        imagePressContext={imagePressContext}
        onOpenImage={onOpenImage}
        onOpenVideo={onOpenVideo}
      />
      {poll && onVote ? <PollCard poll={poll} disabled={disabled} onVote={onVote} /> : null}
      {featuredComment && onOpenFeaturedThread ? (
        <FeaturedCommentPreview comment={featuredComment} onOpenThread={onOpenFeaturedThread} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { minWidth: 0, gap: 4 },
})
