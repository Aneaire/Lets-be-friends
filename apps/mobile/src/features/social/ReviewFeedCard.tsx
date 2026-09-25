import type { FunctionReturnType } from 'convex/server'
import { useMutation } from 'convex/react'
import { router } from 'expo-router'
import { useState } from 'react'
import { Share } from 'react-native'

import { api as generatedApi } from '../../../../web/convex/_generated/api'

import { mobileApi, type ReviewId } from '@/backend/client'
import { formatMessageTimestamp } from '@/data/messageViewModels'
import { showAppToast } from '@/design-system/molecules/AppToast'

import { ReviewFeedCardPresentation } from './ReviewFeedCardPresentation'
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
  const review = item.review
  const toggleLike = useMutation(mobileApi.reviews.toggleLike)
  const toggleSave = useMutation(mobileApi.reviews.toggleSave)
  const createPost = useMutation(mobileApi.social.createPost)
  const [busy, setBusy] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const companionProfileId = review.companionProfileId ? String(review.companionProfileId) : ''
  const companionName = review.companionDisplayName ?? 'this Companion'
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
    <>
      <ReviewFeedCardPresentation
        reviewerDisplayName={review.reviewerDisplayName}
        reviewerProfileImageUrl={review.reviewerProfileImageUrl}
        timestamp={formatMessageTimestamp(review.createdAt)}
        companionName={companionName}
        rating={review.rating}
        body={review.body}
        imageUrl={review.imageUrl}
        liked={Boolean(review.liked)}
        likeCount={review.likeCount ?? 0}
        saved={Boolean(review.saved)}
        commentCount={review.commentCount ?? 0}
        disabled={!signedIn || busy}
        onOpenReviewerProfile={() => openMemberProfile(String(review.reviewerId))}
        onOpenReview={openReview}
        onLike={() => void like()}
        onSave={() => void save()}
        onShare={signedIn ? () => setShareOpen(true) : undefined}
      />
      <ShareSheet
        visible={shareOpen}
        title="Share review"
        previewLabel={`Review by ${review.reviewerDisplayName}`}
        previewBody={review.body}
        onShareToFeed={shareToFeed}
        onShareLink={shareLink}
        onClose={() => setShareOpen(false)}
      />
    </>
  )
}
