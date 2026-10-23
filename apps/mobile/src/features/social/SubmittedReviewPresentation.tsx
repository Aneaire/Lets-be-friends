import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { Screen } from '@/design-system/templates/Screen'
import { ModalPostImageViewer } from '@/features/media/ModalPostImageViewer'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import { ReviewFeedCardPresentation } from './ReviewFeedCardPresentation'
import { ShareSheet } from './ShareSheet'

export type SubmittedReviewPresentationReview = {
  id: string
  reviewerId: string
  reviewerDisplayName: string
  reviewerProfileImageUrl?: string | null
  timestamp: string
  revieweeDisplayName: string
  companionProfileId?: string
  rating: number
  body?: string
  imageUrl?: string | null
  liked: boolean
  likeCount: number
  saved: boolean
  commentCount: number
  comments: Array<{ id: string; authorDisplayName: string; body: string; timestamp: string; ownComment: boolean }>
}

export function SubmittedReviewPresentation({ review, busy, commentBusy, commentDraft, onBack, onOpenReviewerProfile, onOpenPublicReview, onLike, onSave, onShareToFeed, onShareLink, onCommentDraftChange, onSubmitComment, onDeleteComment }: {
  review: SubmittedReviewPresentationReview
  busy: boolean
  commentBusy: boolean
  commentDraft: string
  onBack: () => void
  onOpenReviewerProfile: () => void
  onOpenPublicReview: () => void
  onLike: () => void
  onSave: () => void
  onShareToFeed: (note: string) => Promise<void>
  onShareLink: () => Promise<void>
  onCommentDraftChange: (value: string) => void
  onSubmitComment: () => void
  onDeleteComment: (id: string) => void
}) {
  const theme = useAppTheme()
  const [shareOpen, setShareOpen] = useState(false)
  const [viewerImage, setViewerImage] = useState<{ url: string; index: number; total: number } | null>(null)
  const blurTarget = useRef<View | null>(null)
  const publiclyShareable = Boolean(review.companionProfileId)

  return (
    <View ref={blurTarget} style={styles.route}>
      <Screen contentStyle={styles.content}>
        <AppHeader title="Your review" back onBack={onBack} />
        <AppText variant="caption" color={theme.colors.textMuted}>Only you can open this page. It shows the review exactly as you submitted it.</AppText>
        {!publiclyShareable ? <AppText variant="caption" color={theme.colors.textMuted}>This private Companion-to-member review cannot be shared publicly.</AppText> : null}
        <ReviewFeedCardPresentation
          reviewerDisplayName={review.reviewerDisplayName}
          reviewerProfileImageUrl={review.reviewerProfileImageUrl}
          timestamp={review.timestamp}
          companionName={review.revieweeDisplayName}
          rating={review.rating}
          body={review.body}
          imageUrl={review.imageUrl}
          liked={review.liked}
          likeCount={review.likeCount}
          saved={review.saved}
          commentCount={review.commentCount}
          disabled={busy}
          onOpenReviewerProfile={onOpenReviewerProfile}
          onOpenReview={publiclyShareable ? onOpenPublicReview : undefined}
          onLike={onLike}
          onSave={onSave}
          onShare={publiclyShareable ? () => setShareOpen(true) : undefined}
          onOpenImage={review.imageUrl ? () => setViewerImage({ url: review.imageUrl!, index: 0, total: 1 }) : undefined}
        />
        <View style={styles.comments}>
          <AppText variant="heading">Comments</AppText>
          {review.comments.length === 0 ? <AppText variant="caption" color={theme.colors.textMuted}>No comments yet.</AppText> : review.comments.map((comment) => (
            <View key={comment.id} style={styles.comment}>
              <View style={styles.commentCopy}>
                <AppText variant="bodyStrong" numberOfLines={1}>{comment.authorDisplayName}</AppText>
                <AppText>{comment.body}</AppText>
                <AppText variant="caption" color={theme.colors.textMuted}>{comment.timestamp}</AppText>
              </View>
              {comment.ownComment ? <ActionButton label="Delete" onPress={() => onDeleteComment(comment.id)} intent="neutral" secondary compact /> : null}
            </View>
          ))}
          <TextField accessibilityLabel="Write a comment on your review" value={commentDraft} onChangeText={onCommentDraftChange} placeholder="Add a comment" multiline maxLength={501} editable={!commentBusy} />
          <ActionButton label={commentBusy ? 'Posting comment' : 'Post comment'} onPress={onSubmitComment} intent="social" secondary loading={commentBusy} disabled={commentBusy || !commentDraft.trim()} />
        </View>
      </Screen>
      {publiclyShareable ? <ShareSheet visible={shareOpen} title="Share review" previewLabel={`Review by ${review.reviewerDisplayName}`} previewBody={review.body} onShareToFeed={onShareToFeed} onShareLink={onShareLink} onClose={() => setShareOpen(false)} /> : null}
      <ModalPostImageViewer image={viewerImage} blurTarget={blurTarget} onClose={() => setViewerImage(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  route: { flex: 1 },
  content: { gap: density.contentGap, paddingBottom: 40 },
  comments: { gap: density.cardGap },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: density.cardGap },
  commentCopy: { flex: 1, gap: 2 },
})
