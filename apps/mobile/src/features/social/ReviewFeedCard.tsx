import type { FunctionReturnType } from 'convex/server'
import { useMutation } from 'convex/react'
import { router } from 'expo-router'
import { useState } from 'react'
import { Image, Pressable, Share, StyleSheet, View } from 'react-native'

import { api as generatedApi } from '../../../../web/convex/_generated/api'

import { mobileApi, type ReviewId } from '@/backend/client'
import { formatMessageTimestamp } from '@/data/messageViewModels'
import { Avatar } from '@/design-system/atoms/Avatar'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { showAppToast } from '@/design-system/molecules/AppToast'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { ShareSheet } from './ShareSheet'
import { reviewShareUrl } from './shareLinks'
import { openMemberProfile } from './socialNavigation'

type FeedItem = FunctionReturnType<typeof generatedApi.social.feedPage>['page'][number]
type FeedReviewItem = Extract<FeedItem, { kind: 'review' }>
type FeedAction = 'open_companion' | 'open_guidance' | 'open_review' | 'comment' | 'like' | 'save' | 'share' | 'follow' | 'report' | 'report_comment'

export function ReviewFeedCard({ item, signedIn, onAction }: {
  item: FeedReviewItem
  signedIn: boolean
  onAction: (action: FeedAction) => void
}) {
  const theme = useAppTheme()
  const review = item.review
  const toggleLike = useMutation(mobileApi.reviews.toggleLike)
  const toggleSave = useMutation(mobileApi.reviews.toggleSave)
  const createPost = useMutation(mobileApi.social.createPost)
  const [busy, setBusy] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const companionProfileId = review.companionProfileId ? String(review.companionProfileId) : ''
  const companionName = review.companionDisplayName ?? 'this Companion'
  const profileLabel = `View ${review.reviewerDisplayName}'s profile`
  const shareUrl = companionProfileId ? reviewShareUrl(companionProfileId, String(review._id)) : undefined

  function openReview() {
    onAction('open_review')
    if (!companionProfileId) return
    router.push({ pathname: '/companion-profile/[id]', params: { id: companionProfileId, reviewId: String(review._id) } })
  }

  async function like() {
    if (!signedIn || busy) return
    setBusy(true)
    try {
      await toggleLike({ reviewId: review._id as ReviewId })
      onAction('like')
    } catch {
      showAppToast('The rating like could not be updated.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!signedIn || busy) return
    setBusy(true)
    try {
      await toggleSave({ reviewId: review._id as ReviewId })
      onAction('save')
    } catch {
      showAppToast('Saved ratings could not be updated.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function shareLink() {
    if (!shareUrl) {
      showAppToast('Sharing needs the web app URL configured.', 'error')
      return
    }
    await Share.share({ message: shareUrl })
    onAction('share')
  }

  async function shareToFeed(note: string) {
    await createPost({ body: note, sharedReviewId: review._id as ReviewId })
    onAction('share')
    showAppToast('Shared to your feed.', 'success')
  }

  return (
    <PostCard
      author={review.reviewerDisplayName}
      imageUrl={review.reviewerProfileImageUrl}
      timestamp={formatMessageTimestamp(review.createdAt)}
      avatarAction={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={profileLabel}
          onPress={() => openMemberProfile(String(review.reviewerId))}
          hitSlop={3}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Avatar uri={review.reviewerProfileImageUrl} name={review.reviewerDisplayName} size={42} />
        </Pressable>
      )}
      authorAction={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={profileLabel}
          onPress={() => openMemberProfile(String(review.reviewerId))}
          style={({ pressed }) => [styles.authorLink, pressed && styles.pressed]}
        >
          <AppText variant="bodyStrong" numberOfLines={1}>{review.reviewerDisplayName}</AppText>
        </Pressable>
      )}
      meta={(
        <Pressable accessibilityRole="button" onPress={openReview} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
          <AppText variant="caption" color={theme.colors.socialText}>Experience with {companionName}</AppText>
        </Pressable>
      )}
      footer={(
        <PostActionBar
          liked={Boolean(review.liked)}
          likeCount={review.likeCount ?? 0}
          saved={Boolean(review.saved)}
          commentCount={review.commentCount ?? 0}
          disabled={!signedIn || busy}
          commentLabel="View review"
          onLike={() => void like()}
          onComment={openReview}
          onSave={() => void save()}
          onShare={signedIn ? () => setShareOpen(true) : undefined}
        />
      )}
    >
      <View style={styles.body}>
        <View style={styles.stars} aria-label={`${review.rating} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, index) => (
            <AppIcon
              key={index}
              name={index < Math.round(review.rating) ? 'star' : 'star-outline'}
              size={16}
              color={theme.colors.socialText}
            />
          ))}
          <AppText variant="caption" color={theme.colors.textMuted}>{review.rating.toFixed(1)}</AppText>
        </View>
        {review.body ? <AppText>{review.body}</AppText> : null}
        {review.imageUrl ? (
          <Image
            accessibilityLabel={`Photo shared with ${review.reviewerDisplayName}'s review`}
            source={{ uri: review.imageUrl }}
            resizeMode="cover"
            style={styles.image}
          />
        ) : null}
        <ShareSheet
          visible={shareOpen}
          title="Share review"
          previewLabel={`Review by ${review.reviewerDisplayName}`}
          previewBody={review.body}
          onShareToFeed={shareToFeed}
          onShareLink={shareLink}
          onClose={() => setShareOpen(false)}
        />
      </View>
    </PostCard>
  )
}

const styles = StyleSheet.create({
  body: { minWidth: 0, gap: density.textStackGap },
  authorLink: { maxWidth: '72%', flexShrink: 1 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  image: { width: '100%', height: 180, borderRadius: 10 },
  pressed: { opacity: 0.68 },
})
