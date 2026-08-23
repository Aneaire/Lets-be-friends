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
import { Avatar } from '@/design-system/atoms/Avatar'
import { Chip } from '@/design-system/atoms/Chip'
import { ReportAction } from '@/features/safety/ReportAction'
import { MemberSafetyActions } from '@/features/safety/MemberSafetyActions'
import { Screen, Section } from '@/design-system/templates/Screen'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'
import { mapPublicCompanion, resolveCompanionBookingAction, type ApprovedCompanionRecord, type CompanionDetailViewModel } from '@/data/companionViewModels'
import { formatMessageTimestamp } from '@/data/messageViewModels'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

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
  const [busy, setBusy] = useState<'message' | 'save' | 'follow' | null>(null)
  const [message, setMessage] = useState('')
  useAppToastMessage(message)
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
          <View style={styles.nameRow}><AppText variant="title">{companion.name}</AppText><View accessibilityLabel="Identity verified" style={[styles.verified, { backgroundColor: theme.colors.self }]} /></View>
          <AppText color={theme.colors.textMuted}>{companion.location}</AppText>
          {companion.distanceLabel ? <AppText variant="caption" color={theme.colors.textMuted}>{companion.distanceLabel} approximate</AppText> : null}
          <View style={styles.identityMeta}><AppText variant="caption">{companion.reviewCount ? `★ ${companion.rating?.toFixed(1)} from ${companion.reviewCount}` : 'New Companion'}</AppText><AppText variant="caption">{modeLabels.join(' + ')}</AppText></View>
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
        <View style={[styles.details, { borderColor: theme.colors.border }]}>
          <Detail label="Everyday help and activities" value={companion.categories.join(', ')} />
          <Detail label="Session format" value={modeLabels.join(' and ')} />
          {companion.boundaries.length ? <Detail label="Boundaries" value={companion.boundaries.join(', ')} /> : null}
          {companion.rateLabel ? <Detail label="Rate" value={companion.rateLabel} /> : null}
          <Detail label="Trust" value="Current identity approval and approved public Companion profile" />
        </View>
      </Section>

      <Section>
        <View style={styles.sectionTitle}><AppText variant="heading">Reviews</AppText><AppText variant="caption" color={theme.colors.textMuted}>{reviews?.length ?? 0} shown</AppText></View>
        {reviews === undefined ? <AppText color={theme.colors.textMuted}>Loading reviews.</AppText> : reviews.length ? <ReviewList reviews={reviews} signedIn={signedIn} /> : <AppText color={theme.colors.textMuted}>No public reviews yet.</AppText>}
      </Section>

      <Section>
        <View style={styles.sectionTitle}><AppText variant="heading">Posts</AppText><AppText variant="caption" color={theme.colors.textMuted}>Read only</AppText></View>
        {posts === undefined ? <AppText color={theme.colors.textMuted}>Loading posts.</AppText> : posts.length ? <View style={styles.postList}>{posts.map((post) => <ProfilePost key={post._id} post={post} />)}</View> : <AppText color={theme.colors.textMuted}>No public posts yet.</AppText>}
      </Section>

      <Section style={styles.bottomSection}>
        <AppText variant="caption" color={theme.colors.textMuted}>{bookingAction.explanation}</AppText>
        {signedIn ? <ReportAction targetType="profile" targetId={companion.id} label="Report this profile" /> : null}
        {signedIn && !ownProfile && companion.userId ? <MemberSafetyActions userId={companion.userId} displayName={companion.name} /> : null}
      </Section>
    </Screen>
  )
}

function ReviewList({ reviews, signedIn }: { reviews: Review[]; signedIn: boolean }) {
  const theme = useAppTheme()
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

  return <View style={styles.reviewList}>{reviews.map((review) => <View key={review._id} style={[styles.review, { borderBottomColor: theme.colors.border }]}>
    <View style={styles.sectionTitle}><AppText variant="bodyStrong">{review.reviewerDisplayName}</AppText><AppText variant="caption">{review.rating} ★</AppText></View>
    {review.body ? <AppText>{review.body}</AppText> : null}
    <AppText variant="caption" color={theme.colors.textMuted}>{formatMessageTimestamp(review.createdAt)}</AppText>
    {signedIn ? <View style={styles.reviewActions}><Pressable accessibilityRole="button" accessibilityLabel={savedIds.has(String(review._id)) ? 'Unsave review' : 'Save review'} onPress={() => void toggle(review)} style={styles.textAction}><AppText variant="caption" color={theme.colors.socialText}>{savedIds.has(String(review._id)) ? 'Saved' : 'Save'}</AppText></Pressable><ReportAction targetType="review" targetId={String(review._id)} label="Report review" compact /></View> : null}
  </View>)}</View>
}

function ProfilePost({ post }: { post: Post }) {
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

  return <View style={[styles.post, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
    <AppText>{post.body}</AppText>
    {post.media.filter((media) => media.kind === 'image' && media.url).map((media, index) => <Image key={`${media.storageId}-${index}`} source={{ uri: media.url! }} resizeMode="cover" style={styles.postImage} accessibilityLabel="Post image" />)}
    {post.media.filter((media) => media.kind === 'video' && media.url).map((media, index) => <Pressable key={`${media.storageId}-video-${index}`} accessibilityRole="link" accessibilityLabel="Open post video" onPress={() => void openVideo(media.url!)} style={[styles.postVideoLink, { borderColor: theme.colors.border }]}><AppText variant="bodyStrong" color={theme.colors.socialText}>Open post video</AppText><AppText variant="caption" color={theme.colors.textMuted}>Opens through your device's supported video app</AppText></Pressable>)}
    {mediaError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{mediaError}</AppText> : null}
    <AppText variant="caption" color={theme.colors.textMuted}>{formatMessageTimestamp(post.createdAt)} · {post.likeCount} likes · {post.commentCount} comments</AppText>
  </View>
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
  details: { borderTopWidth: 1, marginTop: 14, paddingTop: 12, gap: 12 },
  detailRow: { gap: 3 },
  detailValue: { flex: 1 },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  reviewList: { marginTop: 8 },
  review: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 5 },
  reviewActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  textAction: { minHeight: 44, justifyContent: 'center' },
  postList: { gap: 10, marginTop: 10 },
  post: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  postImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10 },
  postVideoLink: { minHeight: 60, borderWidth: 1, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  bottomSection: { gap: 10 },
})
