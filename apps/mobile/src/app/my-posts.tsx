import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { mobileApi, type UserId } from '@/backend/client'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { SegmentedControl } from '@/design-system/molecules/SegmentedControl'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen, Section } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { AppText } from '@/design-system/atoms/Typography'
import { ReviewFeedCard } from '@/features/social/ReviewFeedCard'
import { MemberProfilePosts } from '@/member/MemberProfilePosts'
import { memberContentTabLabel, ownReviewsQueryArgs, ownReviewsUiStatus, toOwnReviewFeedItem } from '@/member/memberContent'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type FeedReviewItem = Extract<FunctionReturnType<typeof mobileApi.social.feedPage>['page'][number], { kind: 'review' }>
type ContentTab = 'posts' | 'reviews'

export default function MyPostsScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <OwnContentState title="Sign in to see your posts" action="Sign in" onPress={() => router.push('/auth')} />
  if (member.status === 'unconfigured') return <OwnContentState title="Your posts need account services" detail="Connect your account to view your own posts and reviews." />
  if (member.status === 'unavailable' || member.status === 'error') return <OwnContentState title="Your posts are unavailable" detail={member.message} />
  if (member.status !== 'ready') return <PageSkeleton variant="profile" />
  return <ReadyOwnContent viewerId={member.viewer._id} displayName={member.viewer.displayName} />
}

function ReadyOwnContent({ viewerId, displayName }: { viewerId: UserId; displayName: string }) {
  const theme = useAppTheme()
  const [tab, setTab] = useState<ContentTab>('posts')
  const posts = useQuery(mobileApi.social.byUser, { userId: viewerId })
  const application = useQuery(mobileApi.companions.myApplication, {})
  const reviews = useQuery(mobileApi.reviews.forCompanion, ownReviewsQueryArgs(application))
  const reviewsStatus = ownReviewsUiStatus(application, reviews)

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="My posts and reviews" back onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.self}>YOUR CONTENT</AppText>
        <AppText variant="title">Posts and reviews</AppText>
        <AppText color={theme.colors.textMuted}>Only your public posts appear here. Reviews appear after you have an approved Companion profile.</AppText>
      </View>
      <SegmentedControl
        label="Your content"
        value={tab}
        onChange={setTab}
        tone="self"
        options={(['posts', 'reviews'] as const).map((value) => ({ value, label: memberContentTabLabel(value) }))}
      />
      {tab === 'posts' ? (
        <Section>
          <MemberProfilePosts
            ownerName={displayName}
            posts={posts}
            signedIn
            showSignInPrompt={false}
            emptyDescription="Share a post from Home when you are ready."
          />
        </Section>
      ) : (
        <Section>
          <AppText variant="heading">Reviews of your Companion profile</AppText>
          {reviewsStatus === 'loading' ? (
            <AppText variant="caption" color={theme.colors.textMuted}>Loading reviews.</AppText>
          ) : reviewsStatus === 'needs_companion' ? (
            <StateView
              embedded
              title="Reviews appear after you become a Companion"
              detail="Members can leave a review after a completed plan."
              actionLabel="Open Companion tools"
              onAction={() => router.push('/companion')}
            />
          ) : reviewsStatus === 'empty' ? (
            <StateView embedded title="No reviews yet" detail="Reviews will appear here after members complete plans with you." />
          ) : (
            <View style={styles.reviews}>
              {(reviews ?? []).map((review) => (
                <ReviewFeedCard
                  key={String(review._id)}
                  item={toOwnReviewFeedItem(review, displayName) as FeedReviewItem}
                  signedIn
                  onAction={() => undefined}
                />
              ))}
            </View>
          )}
        </Section>
      )}
    </Screen>
  )
}

function OwnContentState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="YOUR CONTENT" title={title} detail={detail} actionLabel={action} onAction={onPress} intent="self" /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <OwnContentState title="Your posts are temporarily unavailable" detail="Please try again. No social action was taken." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  state: { paddingHorizontal: 16 },
  header: { gap: 4, paddingVertical: 12 },
  reviews: { gap: 10 },
})
