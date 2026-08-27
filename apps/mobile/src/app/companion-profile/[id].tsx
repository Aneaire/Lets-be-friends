import type { FunctionReturnType } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import * as Linking from 'expo-linking'
import { useState } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'

import { mobileApi, type CompanionProfileId, type ReviewId, type UserId } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { Avatar } from '@/design-system/atoms/Avatar'
import { Chip } from '@/design-system/atoms/Chip'
import { ReportAction } from '@/features/safety/ReportAction'
import { MemberSafetyActions } from '@/features/safety/MemberSafetyActions'
import { SegmentedControl } from '@/design-system/molecules/SegmentedControl'
import { Screen, Section } from '@/design-system/templates/Screen'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'
import { PostCard } from '@/features/social/PostCard'
import { PostMediaGrid } from '@/features/social/PostMediaGrid'
import { companionContentTabHeader, companionContentTabs, defaultCompanionContentTab, type CompanionContentTab } from '@/features/companion/companionProfilePresentation'
import { mapPublicCompanion, resolveCompanionBookingAction, type ApprovedCompanionRecord, type CompanionDetailViewModel } from '@/data/companionViewModels'
import { formatMessageTimestamp } from '@/data/messageViewModels'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

type Review = FunctionReturnType<typeof mobileApi.reviews.forCompanion>[number]
type Post = FunctionReturnType<typeof mobileApi.social.byUser>[number]

export default function CompanionProfileScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const configuration = useMobileBackendConfiguration()
  const id = typeof params.id === 'string' ? params.id : ''

  if (configuration.status !== 'configured') return <ProfileState title="Companion profiles need member services" detail="This build cannot connect to approved profiles." />
  if (!id) return <ProfileState title="Companion not found" detail="This profile link is incomplete." />
  return <ConnectedCompanionProfile id={id} />
}

function ConnectedCompanionProfile({ id }: { id: string }) {
  const directory = useQuery(mobileApi.companions.listApproved, {})
  const record = directory?.find((item: ApprovedCompanionRecord) => String(item._id) === id)
  const result = useQuery(mobileApi.companions.getPublic, record ? { companionProfileId: id as CompanionProfileId } : 'skip')

  if (directory === undefined || (record && result === undefined)) return <ProfileState title="Loading public profile" detail="Checking the approved Companion directory." loading />
  if (!record || result === null) return <ProfileState title="Companion not found" detail="This approved profile is no longer available." action="Return to Explore" onPress={() => router.replace('/explore')} />
  return <CompanionDetail companion={mapPublicCompanion(result as ApprovedCompanionRecord)} />
}

function CompanionDetail({ companion }: { companion: CompanionDetailViewModel }) {
  const theme = useAppTheme()
  const member = useMobileMember()
  const startConversation = useMutation(mobileApi.conversations.start)
  const toggleSave = useMutation(mobileApi.companions.toggleSaveProfile)
  const toggleFollow = useMutation(mobileApi.social.toggleFollow)
  const reviews = useQuery(mobileApi.reviews.forCompanion, { companionProfileId: companion.id as CompanionProfileId })
  const posts = useQuery(mobileApi.social.byUser, companion.userId ? { userId: companion.userId as UserId } : 'skip')
  const bookingAction = resolveCompanionBookingAction(companion)
  const [saved, setSaved] = useState(Boolean(companion.saved))
  const [following, setFollowing] = useState(Boolean(companion.following))
  const [contentTab, setContentTab] = useState<CompanionContentTab>(defaultCompanionContentTab())
  const [busy, setBusy] = useState<'message' | 'save' | 'follow' | null>(null)
  const [message, setMessage] = useState('')
  useAppToastMessage(message)
  const contentHeader = companionContentTabHeader(contentTab, { rating: companion.rating, reviewCount: companion.reviewCount })
  const modeLabels = companion.sessionModes.map((mode) => mode === 'online' ? 'Online' : 'In person')
  const signedIn = member.status === 'ready'
  const ownProfile = signedIn && String(member.viewer._id) === companion.userId

  async function messageCompanion() {
    if (!companion.userId || !signedIn || busy) return
    setBusy('message')
    setMessage('')
    try {
      const conversationId = await startConversation({ otherUserId: companion.userId as UserId })
      router.push({ pathname: '/conversation/[id]', params: { id: String(conversationId) } })
    } catch {
      setMessage('A conversation could not be opened. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function saveProfile() {
    if (!signedIn || busy) return
    setBusy('save')
    setMessage('')
    try {
      setSaved(await toggleSave({ companionProfileId: companion.id as CompanionProfileId }))
    } catch {
      setMessage('This profile could not be updated in your saved list.')
    } finally {
      setBusy(null)
    }
  }

  async function followProfile() {
    if (!signedIn || !companion.userId || busy) return
    setBusy('follow')
    setMessage('')
    try {
      setFollowing(await toggleFollow({ userId: companion.userId as UserId }))
    } catch {
      setMessage('Following could not be updated. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  function bookingPress() {
    if (bookingAction.kind === 'sign_in') router.push('/auth')
    else if (bookingAction.kind === 'book') router.push({ pathname: '/booking/new', params: { companionProfileId: companion.id } })
    else setMessage(bookingAction.explanation)
  }

  return (
    <Screen contentStyle={styles.content} footer={!ownProfile ? <View style={styles.stickyActions}><ActionButton label={busy === 'message' ? 'Opening' : 'Message'} onPress={() => void messageCompanion()} disabled={!signedIn || !companion.userId || busy !== null} intent="social" secondary icon="chatbubble-outline" style={styles.flexAction} /><ActionButton label={bookingAction.kind === 'book' ? 'Plan an experience' : bookingAction.label} onPress={bookingPress} disabled={bookingAction.kind === 'own_profile' || bookingAction.kind === 'unavailable'} intent="social" icon="calendar-outline" style={styles.flexAction} /></View> : undefined}>
      <AppHeader title="Companion profile" back onBack={goBackOrExplore} />
      <View style={styles.identity}>
        <Avatar uri={companion.imageUrl} name={companion.name} size={88} />
        <View style={styles.identityCopy}>
          <View style={styles.nameRow}><AppText variant="title">{companion.name}</AppText>{companion.verified ? <View accessibilityLabel="Identity verified" style={[styles.verified, { backgroundColor: theme.colors.textMuted }]} /> : null}</View>
          <AppText color={theme.colors.textMuted}>{companion.location}</AppText>
          {companion.distanceLabel ? <AppText variant="caption" color={theme.colors.textMuted}>{companion.distanceLabel} approximate</AppText> : null}
          <View style={styles.identityMeta}><AppText variant="caption">{companion.reviewCount ? `★ ${companion.rating?.toFixed(1)} from ${companion.reviewCount}` : 'New Companion'}</AppText><AppText variant="caption">{modeLabels.join(' + ')}</AppText></View>
          <AppText variant="caption" color={theme.colors.textMuted}>{companion.verified ? 'Identity verified · Companion profile approved' : 'Companion profile in review'}</AppText>
        </View>
      </View>
      <AppText variant="heading">{companion.intro}</AppText>
      {companion.bio ? <AppText color={theme.colors.textMuted}>{companion.bio}</AppText> : null}

      <View style={styles.actionsRow}>
        <ActionButton label={saved ? 'Saved' : 'Save'} onPress={() => void saveProfile()} disabled={!signedIn || busy !== null} secondary style={styles.flexAction} />
        {!ownProfile ? <ActionButton label={following ? 'Following' : 'Follow'} onPress={() => void followProfile()} disabled={!signedIn || !companion.userId || busy !== null} secondary style={styles.flexAction} /> : null}
      </View>
      {!signedIn ? <AppText variant="caption" color={theme.colors.textMuted}>Sign in to message, save, follow, or book this Companion.</AppText> : null}

      <Section>
        <AppText variant="heading">Strengths and what they offer</AppText>
        <View style={styles.chips}>{companion.strengths.map((strength) => <Chip key={strength} label={strength} />)}</View>
        <View style={styles.details}>
          <Detail label="Everyday help and activities" value={companion.categories.join(', ')} />
          <Detail label="Session format" value={modeLabels.join(' and ')} />
          {companion.boundaries.length ? <Detail label="Boundaries" value={companion.boundaries.join(', ')} /> : null}
          {companion.rateLabel ? <Detail label="Rate" value={companion.rateLabel} /> : null}
        </View>
      </Section>

      <Section>
        <SegmentedControl
          label={`${companion.name} profile content`}
          options={companionContentTabs.map((tab) => ({ value: tab.value, label: tab.label }))}
          value={contentTab}
          onChange={setContentTab}
          tone="social"
          style={styles.contentTabs}
        />
      </Section>

      {contentTab === 'posts' ? (
        <View style={styles.tabPanel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderCopy}>
              <AppText variant="heading">{contentHeader.title}</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>{contentHeader.description}</AppText>
            </View>
          </View>
          {posts === undefined ? <AppText color={theme.colors.textMuted}>Loading posts.</AppText> : posts.length ? <View style={styles.cardList}>{posts.map((post) => <View key={post._id} style={[styles.postCard, { borderColor: theme.colors.border }]}><ProfilePost post={post} companionName={companion.name} imageUrl={companion.imageUrl} /></View>)}</View> : <AppText color={theme.colors.textMuted}>No public posts yet.</AppText>}
        </View>
      ) : (
        <View style={styles.tabPanel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderCopy}>
              <AppText variant="heading">{contentHeader.title}</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>{contentHeader.description}</AppText>
            </View>
            {contentHeader.ratingSummary ? <AppText variant="bodyStrong" color={theme.colors.socialText} style={styles.ratingSummary}>{contentHeader.ratingSummary}</AppText> : null}
          </View>
          {reviews === undefined ? <AppText color={theme.colors.textMuted}>Loading reviews.</AppText> : reviews.length ? <ReviewList reviews={reviews} signedIn={signedIn} /> : <AppText color={theme.colors.textMuted}>No public reviews yet.</AppText>}
        </View>
      )}

      <Section style={styles.bottomSection}>
        <AppText variant="caption" color={theme.colors.textMuted}>{bookingAction.explanation}</AppText>
        {signedIn ? <ReportAction targetType="profile" targetId={companion.id} label="Report this profile" /> : null}
        {signedIn && !ownProfile && companion.userId ? <MemberSafetyActions userId={companion.userId} displayName={companion.name} /> : null}
      </Section>
    </Screen>
  )
}

function ReviewList({ reviews, signedIn }: { reviews: Review[]; signedIn: boolean }) {
  const toggleSave = useMutation(mobileApi.reviews.toggleSave)
  const [savedIds, setSavedIds] = useState(() => new Set(reviews.filter((review) => review.saved).map((review) => String(review._id))))

  async function toggle(review: Review) {
    try {
      const saved = await toggleSave({ reviewId: review._id as ReviewId })
      setSavedIds((current) => {
        const next = new Set(current)
        if (saved) next.add(String(review._id))
        else next.delete(String(review._id))
        return next
      })
    } catch {
      return
    }
  }

  return <View style={styles.cardList}>{reviews.map((review) => <ReviewCard key={review._id} review={review} signedIn={signedIn} saved={savedIds.has(String(review._id))} onToggleSave={() => void toggle(review)} />)}</View>
}

function ReviewCard({ review, signedIn, saved, onToggleSave }: { review: Review; signedIn: boolean; saved: boolean; onToggleSave: () => void }) {
  const theme = useAppTheme()

  return <View style={[styles.reviewCard, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}>
    <View style={styles.reviewHeader}>
      <Avatar uri={review.reviewerProfileImageUrl ?? undefined} name={review.reviewerDisplayName} size={38} />
      <View style={styles.reviewIdentity}>
        <AppText variant="bodyStrong" numberOfLines={1}>{review.reviewerDisplayName}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{formatMessageTimestamp(review.createdAt)}</AppText>
      </View>
    </View>
    <ReviewStars rating={review.rating} />
    {review.body ? <AppText>{review.body}</AppText> : null}
    {review.imageUrl ? <Image source={{ uri: review.imageUrl }} resizeMode="cover" accessibilityRole="image" accessibilityLabel={`Photo shared with ${review.reviewerDisplayName}'s review`} style={[styles.reviewImage, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} /> : null}
    {signedIn ? <View style={styles.reviewActions}><Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Unsave review' : 'Save review'} onPress={onToggleSave} style={styles.textAction}><AppText variant="caption" color={theme.colors.socialText}>{saved ? 'Saved' : 'Save'}</AppText></Pressable><ReportAction targetType="review" targetId={String(review._id)} label="Report review" compact /></View> : null}
  </View>
}

function ReviewStars({ rating }: { rating: number }) {
  const theme = useAppTheme()
  const filled = Math.round(rating)
  return <View accessibilityRole="text" accessibilityLabel={`${rating.toFixed(1)} out of 5 stars`} style={styles.starsRow}>
    <View style={styles.stars}>{Array.from({ length: 5 }, (_, index) => <AppIcon key={index} name={index < filled ? 'star' : 'star-outline'} color={index < filled ? theme.colors.socialText : theme.colors.textMuted} size={14} />)}</View>
    <AppText variant="caption" color={theme.colors.textMuted}>{rating.toFixed(1)}</AppText>
  </View>
}

function ProfilePost({ post, companionName, imageUrl }: { post: Post; companionName: string; imageUrl?: string }) {
  const theme = useAppTheme()
  const [mediaError, setMediaError] = useState('')

  async function openVideo(url: string) {
    setMediaError('')
    try {
      await Linking.openURL(url)
    } catch {
      setMediaError('This post video could not be opened safely.')
    }
  }

  return <PostCard author={companionName} imageUrl={imageUrl} timestamp={formatMessageTimestamp(post.createdAt)} meta={<AppText variant="caption" color={theme.colors.textMuted}>· {post.likeCount} likes · {post.commentCount} comments</AppText>}>
    {post.body ? <AppText>{post.body}</AppText> : null}
    {post.media.length > 0 ? <PostMediaGrid media={post.media} onOpenVideo={(url) => void openVideo(url)} /> : null}
    {mediaError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{mediaError}</AppText> : null}
  </PostCard>
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme()
  return <View style={styles.detailRow}><AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText><AppText variant="bodyStrong" style={styles.detailValue}>{value}</AppText></View>
}

function ProfileState({ title, detail, action, onPress, loading = false }: { title: string; detail?: string; action?: string; onPress?: () => void; loading?: boolean }) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="COMPANION" title={title} detail={detail} actionLabel={action} onAction={onPress} loading={loading} /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <ProfileState title="This Companion could not be loaded" detail="The live profile is temporarily unavailable." action="Try again" onPress={retry} />
}

function goBackOrExplore() {
  if (router.canGoBack()) router.back()
  else router.replace('/explore')
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  state: { paddingHorizontal: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18 },
  identityCopy: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verified: { width: 9, height: 9, borderRadius: 5 },
  identityMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 3 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  stickyActions: { flexDirection: 'row', gap: 10, width: '100%', maxWidth: 760, alignSelf: 'center' },
  flexAction: { flex: 1, minHeight: 46, paddingHorizontal: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  details: { gap: 12, marginTop: 14 },
  detailRow: { gap: 3 },
  detailValue: { flex: 1 },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  contentTabs: { marginTop: 2 },
  tabPanel: { marginTop: 6, gap: 10 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  panelHeaderCopy: { flex: 1, gap: 2 },
  ratingSummary: { flexShrink: 0, textAlign: 'right' },
  cardList: { gap: 10 },
  postCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: density.controlRadius, overflow: 'hidden' },
  reviewCard: { gap: density.textStackGap, paddingHorizontal: density.compactCardPadding, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: density.controlRadius },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: density.cardGap },
  reviewIdentity: { flex: 1, minWidth: 0, gap: 1 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  reviewImage: { width: '100%', aspectRatio: 4 / 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  reviewActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 2 },
  textAction: { minHeight: 44, justifyContent: 'center' },
  bottomSection: { gap: 10 },
})
