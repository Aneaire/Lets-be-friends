import type { FunctionReturnType } from 'convex/server'
import { router } from 'expo-router'

import { mobileApi } from '@/backend/client'

import { SocialPostCard } from './SocialPostCard'
import type { PostViewerImage } from './PostImageViewer'
import { CompanionRecommendationCard, GuidanceFeedCard } from './SocialFeedRecommendations'
import { ReviewFeedCard } from './ReviewFeedCard'

type FeedItem = FunctionReturnType<typeof mobileApi.social.feedPage>['page'][number]
type FeedAction = 'open_companion' | 'open_guidance' | 'open_review' | 'comment' | 'like' | 'save' | 'share' | 'follow' | 'report' | 'report_comment'

export function SocialFeedCard({ item, signedIn, following, followBusy = false, onToggleFollow, onOpenImage, onAction }: {
  item: FeedItem
  signedIn: boolean
  following?: boolean
  followBusy?: boolean
  onToggleFollow?: (authorId: string) => Promise<boolean | undefined>
  /**
   * Direct photo viewer handler. Home passes its feed-level lightbox so feed
   * photo taps open full screen without leaving the feed. When omitted, taps
   * fall back to opening the post comments thread.
   */
  onOpenImage?: (image: PostViewerImage) => void
  onAction: (action: FeedAction) => void
}) {
  if (item.kind === 'companion') return <CompanionRecommendation item={item} onAction={onAction} />
  if (item.kind === 'guidance') return <GuidanceCard item={item} onAction={onAction} />
  if (item.kind === 'review') return <ReviewFeedCard item={item} signedIn={signedIn} onAction={onAction} />
  return <SocialPostCard post={item.post} signedIn={signedIn} following={following ?? item.post.followingAuthor} followBusy={followBusy} onToggleFollow={onToggleFollow} onOpenImage={onOpenImage} onAction={onAction} />
}

function CompanionRecommendation({ item, onAction }: { item: Extract<FeedItem, { kind: 'companion' }>; onAction: (action: FeedAction) => void }) {
  const companion = item.companion
  return (
    <CompanionRecommendationCard
      companion={{ reason: item.reason, displayName: companion.displayName, mode: companion.mode, intro: companion.intro, strengths: companion.strengths, reviewCount: companion.reviewCount, rating: companion.rating }}
      onPress={() => { onAction('open_companion'); router.push({ pathname: '/companion-profile/[id]', params: { id: String(companion._id) } }) }}
    />
  )
}

function GuidanceCard({ item, onAction }: { item: Extract<FeedItem, { kind: 'guidance' }>; onAction: (action: FeedAction) => void }) {
  return <GuidanceFeedCard reason={item.reason} title={item.title} body={item.body} actionLabel={item.actionLabel} onPress={() => { onAction('open_guidance'); router.push('/nearby') }} />
}
