import type { FunctionReturnType } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import { useState } from 'react'
import { Alert, Share, StyleSheet } from 'react-native'

import { mobileApi, type ReviewCommentId, type ReviewId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { AppText } from '@/design-system/atoms/Typography'
import { validateReviewComment } from '@/data/bookingActions'
import { submittedReviewMemberGate, submittedReviewQueryState } from '@/data/submittedReview'
import { formatMessageTimestamp } from '@/data/messageViewModels'
import { SubmittedReviewPresentation } from '@/features/social/SubmittedReviewPresentation'
import { reviewShareUrl } from '@/features/social/shareLinks'
import { openMemberProfile } from '@/features/social/socialNavigation'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

type Submission = NonNullable<FunctionReturnType<typeof mobileApi.reviews.viewerSubmission>>
type SubmissionComment = Submission['comments'][number]

/**
 * Protected permalink for the reviewer's own submission. `viewerSubmission`
 * only ever returns the signed-in reviewer's own visible review, so another
 * member's id renders the same honest empty state as a removed review.
 */
export default function SubmittedReviewScreen() {
  const member = useMobileMember()
  const params = useLocalSearchParams<{ id?: string }>()
  const reviewId = typeof params.id === 'string' ? params.id : ''

  const gate = submittedReviewMemberGate(member.status, reviewId)
  if (gate === 'signed_out') return <ReviewState title="Sign in to view your review" action="Sign in" onPress={() => router.replace('/auth')} />
  if (gate === 'unconfigured') return <ReviewState title="Reviews need account services" detail="Connect your account to view submitted reviews." />
  if (gate === 'member_unavailable') return <ReviewState title="Your review is unavailable" detail="Your member account could not be connected safely." />
  if (gate === 'loading') return <PageSkeleton variant="profile" />
  if (gate === 'missing_id') return <ReviewState title="Choose a review first" detail="Open a completed booking to view the review you submitted." action="View bookings" onPress={() => router.replace('/bookings')} />
  return <ReadySubmittedReview reviewId={reviewId} />
}

function ReadySubmittedReview({ reviewId }: { reviewId: string }) {
  const review = useQuery(mobileApi.reviews.viewerSubmission, { reviewId: reviewId as ReviewId })
  const toggleLike = useMutation(mobileApi.reviews.toggleLike)
  const toggleSave = useMutation(mobileApi.reviews.toggleSave)
  const createPost = useMutation(mobileApi.social.createPost)
  const createComment = useMutation(mobileApi.reviews.createComment)
  const deleteComment = useMutation(mobileApi.reviews.deleteComment)
  const [busy, setBusy] = useState(false)
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [message, setMessage] = useState('')
  useAppToastMessage(message)

  const queryState = submittedReviewQueryState(review)
  if (queryState === 'loading') return <PageSkeleton variant="profile" />
  if (queryState === 'not_available') {
    return (
      <Screen contentStyle={styles.state}>
        <AppHeader title="Your review" back onBack={goBack} />
        <StateView
          title="This review is not available"
          detail="Reviews can be opened only by the member who submitted them, and only while they are visible."
          actionLabel="View bookings"
          onAction={() => router.replace('/bookings')}
        />
      </Screen>
    )
  }

  const current: Submission = review!
  const companionProfileId = current.companionProfileId ? String(current.companionProfileId) : ''
  const shareUrl = companionProfileId ? reviewShareUrl(companionProfileId, String(current._id)) : undefined

  async function like() {
    if (busy) return
    setBusy(true)
    try {
      await toggleLike({ reviewId: current._id as ReviewId })
    } catch {
      setMessage('The rating like could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (busy) return
    setBusy(true)
    try {
      await toggleSave({ reviewId: current._id as ReviewId })
    } catch {
      setMessage('Saved ratings could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  async function shareLink() {
    if (!shareUrl) {
      setMessage('Sharing needs the web app URL configured.')
      return
    }
    await Share.share({ message: shareUrl })
  }

  async function shareToFeed(note: string) {
    await createPost({ body: note, sharedReviewId: current._id as ReviewId })
    setMessage('Shared to your feed.')
  }

  async function submitComment() {
    const validation = validateReviewComment(commentDraft)
    if (!validation.ok) {
      setMessage(validation.message)
      return
    }
    setCommentBusy(true)
    setMessage('')
    try {
      await createComment({ reviewId: current._id as ReviewId, body: validation.body })
      setCommentDraft('')
    } catch {
      setMessage('Review comment could not be posted.')
    } finally {
      setCommentBusy(false)
    }
  }

  function confirmDeleteComment(commentId: string) {
    Alert.alert('Delete this comment?', 'This action cannot be undone.', [
      { text: 'Keep comment', style: 'cancel' },
      {
        text: 'Delete comment',
        style: 'destructive',
        onPress: () => {
          void deleteComment({ commentId: commentId as ReviewCommentId }).catch(() => {
            setMessage('This comment could not be deleted. Please try again.')
          })
        },
      },
    ])
  }

  return <SubmittedReviewPresentation
    review={{
      id: String(current._id), reviewerId: String(current.reviewerId), reviewerDisplayName: current.reviewerDisplayName,
      reviewerProfileImageUrl: current.reviewerProfileImageUrl, timestamp: formatMessageTimestamp(current.createdAt),
      revieweeDisplayName: current.companionDisplayName ?? current.revieweeDisplayName ?? 'this member',
      companionProfileId: companionProfileId || undefined, rating: current.rating, body: current.body, imageUrl: current.imageUrl,
      liked: Boolean(current.liked), likeCount: current.likeCount ?? 0, saved: Boolean(current.saved), commentCount: current.commentCount ?? 0,
      comments: current.comments.map((comment: SubmissionComment) => ({ id: String(comment._id), authorDisplayName: comment.authorDisplayName, body: comment.body, timestamp: formatMessageTimestamp(comment.createdAt), ownComment: comment.ownComment })),
    }}
    busy={busy}
    commentBusy={commentBusy}
    commentDraft={commentDraft}
    onBack={goBack}
    onOpenReviewerProfile={() => openMemberProfile(String(current.reviewerId))}
    onOpenPublicReview={() => { if (companionProfileId) router.push({ pathname: '/companion-profile/[id]', params: { id: companionProfileId, reviewId: String(current._id) } }) }}
    onLike={() => void like()}
    onSave={() => void save()}
    onShareToFeed={shareToFeed}
    onShareLink={shareLink}
    onCommentDraftChange={(value) => { setCommentDraft(value); setMessage('') }}
    onSubmitComment={() => void submitComment()}
    onDeleteComment={confirmDeleteComment}
  />
}

function ReviewState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen scroll={false} contentStyle={styles.state}><AppText variant="label" color={theme.colors.textMuted}>YOUR REVIEW</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} secondary /> : null}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <ReviewState title="Your review is temporarily unavailable" detail="Please try again. No review action was taken." action="Try again" onPress={retry} />
}

function goBack() {
  if (router.canGoBack()) router.back()
  else router.replace('/bookings')
}

const styles = StyleSheet.create({
  state: { flexGrow: 1, justifyContent: 'center', gap: density.contentGap, paddingHorizontal: 16 },
})
