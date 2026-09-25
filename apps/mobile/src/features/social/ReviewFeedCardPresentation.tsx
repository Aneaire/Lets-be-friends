import { Pressable } from 'react-native'

import { Avatar } from '@/design-system/atoms/Avatar'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { ReviewContent } from './ReviewContent'

export type ReviewFeedCardPresentationProps = {
  reviewerDisplayName: string
  reviewerProfileImageUrl?: string | null
  timestamp: string
  companionName: string
  rating: number
  body?: string
  imageUrl?: string | null
  liked: boolean
  likeCount: number
  saved: boolean
  commentCount: number
  disabled?: boolean
  onOpenReviewerProfile: () => void
  onOpenReview: () => void
  onLike: () => void
  onSave: () => void
  onShare?: () => void
  onOpenImage?: () => void
}

export function ReviewFeedCardPresentation({
  reviewerDisplayName,
  reviewerProfileImageUrl,
  timestamp,
  companionName,
  rating,
  body,
  imageUrl,
  liked,
  likeCount,
  saved,
  commentCount,
  disabled = false,
  onOpenReviewerProfile,
  onOpenReview,
  onLike,
  onSave,
  onShare,
  onOpenImage,
}: ReviewFeedCardPresentationProps) {
  const theme = useAppTheme()
  const profileLabel = `View ${reviewerDisplayName}'s profile`

  return (
    <PostCard
      author={reviewerDisplayName}
      imageUrl={reviewerProfileImageUrl}
      timestamp={timestamp}
      avatarAction={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={profileLabel}
          onPress={onOpenReviewerProfile}
          hitSlop={3}
          style={({ pressed }) => pressed && { opacity: 0.68 }}
        >
          <Avatar uri={reviewerProfileImageUrl ?? undefined} name={reviewerDisplayName} size={42} />
        </Pressable>
      )}
      authorAction={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={profileLabel}
          onPress={onOpenReviewerProfile}
          style={({ pressed }) => [{ maxWidth: '100%', minWidth: 0, flexShrink: 1 }, pressed && { opacity: 0.68 }]}
        >
          <AppText variant="bodyStrong" numberOfLines={1}>{reviewerDisplayName}</AppText>
        </Pressable>
      )}
      meta={(
        <Pressable
          accessibilityRole="button"
          onPress={onOpenReview}
          hitSlop={6}
          style={({ pressed }) => [{ maxWidth: '100%' }, pressed && { opacity: 0.68 }]}
        >
          <AppText variant="caption" color={theme.colors.socialText}>Experience with {companionName}</AppText>
        </Pressable>
      )}
      metaPlacement="below"
      footer={(
        <PostActionBar
          liked={liked}
          likeCount={likeCount}
          saved={saved}
          commentCount={commentCount}
          disabled={disabled}
          commentLabel="View review"
          onLike={onLike}
          onComment={onOpenReview}
          onSave={onSave}
          onShare={onShare}
        />
      )}
    >
      <ReviewContent
        review={{ reviewerDisplayName, rating, body, imageUrl }}
        onOpenImage={onOpenImage}
      />
    </PostCard>
  )
}
