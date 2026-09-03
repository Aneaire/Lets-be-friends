import type { FunctionReturnType } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import * as Linking from 'expo-linking'
import { BlurTargetView } from 'expo-blur'
import { useEffect, useRef, useState } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'

import { mobileApi, type CompanionProfileId, type ReviewId, type UserId } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { Avatar } from '@/design-system/atoms/Avatar'
import { TextField } from '@/design-system/atoms/Field'
import { Chip } from '@/design-system/atoms/Chip'
import { ReportAction } from '@/features/safety/ReportAction'
import { MemberSafetyActions } from '@/features/safety/MemberSafetyActions'
import { SegmentedControl } from '@/design-system/molecules/SegmentedControl'
import { Screen, Section } from '@/design-system/templates/Screen'
import { PageSkeleton, ProfileContentSkeleton } from '@/design-system/templates/PageSkeleton'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'
import { PostCard } from '@/features/social/PostCard'
import { PostImageViewer, type PostViewerImage } from '@/features/social/PostImageViewer'
import { PostMediaGrid } from '@/features/social/PostMediaGrid'
import { companionContentTabHeader, companionContentTabs, companionProfileTypography, companionRatePresentation, defaultCompanionContentTab, type CompanionContentTab } from '@/features/companion/companionProfilePresentation'
import { validateReviewComment } from '@/data/bookingActions'
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

  if (directory === undefined || (record && result === undefined)) return <PageSkeleton variant="publicProfile" />
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
  const blurTarget = useRef<View>(null)
  const [viewerImage, setViewerImage] = useState<PostViewerImage | null>(null)
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
    <View style={styles.route}>
      <BlurTargetView ref={blurTarget} importantForAccessibility={viewerImage ? 'no-hide-descendants' : 'auto'} style={styles.blurTarget}>
        <Screen contentStyle={styles.content} footer={!ownProfile ? <View style={styles.stickyActions}><ActionButton label={busy === 'message' ? 'Opening' : 'Message'} onPress={() => void messageCompanion()} disabled={!signedIn || !companion.userId || busy !== null} intent="social" secondary icon="chatbubble-outline" style={styles.flexAction} /><ActionButton label={bookingAction.kind === 'book' ? 'Plan an experience' : bookingAction.label} onPress={bookingPress} disabled={bookingAction.kind === 'own_profile' || bookingAction.kind === 'unavailable'} intent="social" icon="calendar-outline" style={styles.flexAction} /></View> : undefined}>
      <AppHeader title="Companion profile" back onBack={goBackOrExplore} />
      <View style={styles.identity}>
        <Avatar uri={companion.imageUrl} name={companion.name} size={88} />
        <View style={styles.identityCopy}>
          <View style={styles.nameRow}><AppText style={styles.profileName}>{companion.name}</AppText>{companion.verified ? <View accessibilityLabel="Identity verified" style={[styles.verified, { backgroundColor: theme.colors.textMuted }]} /> : null}</View>
          <AppText color={theme.colors.textMuted}>{companion.location}</AppText>
          {companion.distanceLabel ? <AppText variant="caption" color={theme.colors.textMuted}>{companion.distanceLabel} approximate</AppText> : null}
          <View style={styles.identityMeta}><AppText variant="caption">{companion.reviewCount ? `★ ${companion.rating?.toFixed(1)} from ${companion.reviewCount}` : 'New Companion'}</AppText><AppText variant="caption">{modeLabels.join(' + ')}</AppText></View>
          <AppText variant="caption" color={theme.colors.textMuted}>{companion.verified ? 'Identity verified · Companion profile approved' : 'Companion profile in review'}</AppText>
        </View>
      </View>
      <AppText style={styles.profileIntro}>{companion.intro}</AppText>
      {companion.bio ? <AppText color={theme.colors.textMuted} style={styles.profileBio}>{companion.bio}</AppText> : null}

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
        </View>
        {companion.rateLabel ? <RateHighlight value={companion.rateLabel} /> : null}
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
          {posts === undefined ? <ProfileContentSkeleton /> : posts.length ? <View style={styles.cardList}>{posts.map((post) => <View key={post._id} style={[styles.postCard, { borderColor: theme.colors.border }]}><ProfilePost post={post} companionName={companion.name} imageUrl={companion.imageUrl} /></View>)}</View> : <AppText color={theme.colors.textMuted}>No public posts yet.</AppText>}
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
          {reviews === undefined ? <ProfileContentSkeleton /> : reviews.length ? <ReviewList reviews={reviews} signedIn={signedIn} onOpenImage={setViewerImage} /> : <AppText color={theme.colors.textMuted}>No public reviews yet.</AppText>}
        </View>
      )}

      <Section style={styles.bottomSection}>
        <AppText variant="caption" color={theme.colors.textMuted}>{bookingAction.explanation}</AppText>
        {signedIn ? <ReportAction targetType="profile" targetId={companion.id} label="Report this profile" /> : null}
        {signedIn && !ownProfile && companion.userId ? <MemberSafetyActions userId={companion.userId} displayName={companion.name} /> : null}
      </Section>
        </Screen>
      </BlurTargetView>
      <PostImageViewer image={viewerImage} blurTarget={blurTarget} onClose={() => setViewerImage(null)} />
    </View>
  )
}

function ReviewList({ reviews, signedIn, onOpenImage }: { reviews: Review[]; signedIn: boolean; onOpenImage: (image: PostViewerImage) => void }) {
  const toggleSave = useMutation(mobileApi.reviews.toggleSave)
  const toggleLike = useMutation(mobileApi.reviews.toggleLike)
  const createComment = useMutation(mobileApi.reviews.createComment)
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>({})
  const [likeOverrides, setLikeOverrides] = useState<Record<string, { liked: boolean; likeCount: number }>>({})
  const [openComments, setOpenComments] = useState<Set<string>>(() => new Set())
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [commentBusy, setCommentBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  useAppToastMessage(error)

  useEffect(() => {
    setSavedOverrides((current) => {
      let changed = false
      const next = { ...current }
      for (const review of reviews) {
        const key = String(review._id)
        if (key in next && next[key] === review.saved) {
          delete next[key]
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [reviews])

  useEffect(() => {
    setLikeOverrides((current) => {
      let changed = false
      const next = { ...current }
      for (const review of reviews) {
        const key = String(review._id)
        const local = next[key]
        if (local && local.liked === review.liked) {
          delete next[key]
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [reviews])

  function savedFor(review: Review) {
    return savedOverrides[String(review._id)] ?? review.saved
  }

  function likeFor(review: Review) {
    return likeOverrides[String(review._id)] ?? { liked: review.liked, likeCount: review.likeCount }
  }

  async function toggleSaveReview(review: Review) {
    const key = String(review._id)
    setSavedOverrides((current) => ({ ...current, [key]: !(current[key] ?? review.saved) }))
    try {
      await toggleSave({ reviewId: review._id as ReviewId })
    } catch {
      setSavedOverrides((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
    }
  }

  async function toggleLikeReview(review: Review) {
    const key = String(review._id)
    setLikeOverrides((current) => {
      const previous = current[key] ?? { liked: review.liked, likeCount: review.likeCount }
      return {
        ...current,
        [key]: { liked: !previous.liked, likeCount: Math.max(0, previous.likeCount + (!previous.liked ? 1 : -1)) },
      }
    })
    try {
      await toggleLike({ reviewId: review._id as ReviewId })
    } catch {
      setLikeOverrides((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
      setError('Review like could not be updated.')
    }
  }

  async function submitComment(review: Review) {
    const key = String(review._id)
    const validation = validateReviewComment(commentDrafts[key] ?? '')
    if (!validation.ok) {
      setError(validation.message)
      return
    }
    setCommentBusy(key)
    setError('')
    try {
      await createComment({ reviewId: review._id as ReviewId, body: validation.body })
      setCommentDrafts((current) => ({ ...current, [key]: '' }))
    } catch {
      setError('Review comment could not be posted.')
    } finally {
      setCommentBusy(null)
    }
  }

  return <View style={styles.cardList}>{reviews.map((review) => {
    const key = String(review._id)
    return <ReviewCard
      key={review._id}
      review={review}
      signedIn={signedIn}
      saved={savedFor(review)}
      liked={likeFor(review).liked}
      likeCount={likeFor(review).likeCount}
      commentsOpen={openComments.has(key)}
      commentBusy={commentBusy === key}
      commentDraft={commentDrafts[key] ?? ''}
      onToggleSave={() => void toggleSaveReview(review)}
      onToggleLike={() => void toggleLikeReview(review)}
      onToggleComments={() => setOpenComments((current) => {
        const next = new Set(current)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })}
      onChangeCommentDraft={(value) => { setCommentDrafts((current) => ({ ...current, [key]: value })); setError('') }}
      onSubmitComment={() => void submitComment(review)}
      onOpenImage={() => review.imageUrl ? onOpenImage({ url: review.imageUrl, index: 0, total: 1 }) : undefined}
    />
  })}</View>
}

function ReviewCard({ review, signedIn, saved, liked, likeCount, commentsOpen, commentBusy, commentDraft, onToggleSave, onToggleLike, onToggleComments, onChangeCommentDraft, onSubmitComment, onOpenImage }: {
  review: Review
  signedIn: boolean
  saved: boolean
  liked: boolean
  likeCount: number
  commentsOpen: boolean
  commentBusy: boolean
  commentDraft: string
  onToggleSave: () => void
  onToggleLike: () => void
  onToggleComments: () => void
  onChangeCommentDraft: (value: string) => void
  onSubmitComment: () => void
  onOpenImage: () => void
}) {
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
    {review.imageUrl ? <ReviewImage url={review.imageUrl} reviewerName={review.reviewerDisplayName} onOpen={onOpenImage} /> : null}
    <View style={styles.reviewActions} accessibilityLabel={`Actions for ${review.reviewerDisplayName}'s review`}>
      {signedIn ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={liked ? `Unlike ${review.reviewerDisplayName}'s review` : `Like ${review.reviewerDisplayName}'s review`} accessibilityState={{ selected: liked, disabled: commentBusy }} disabled={commentBusy} onPress={onToggleLike} style={styles.textAction}>
            <AppIcon name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? theme.colors.socialText : theme.colors.textMuted} />
            <AppText variant="caption" color={liked ? theme.colors.socialText : theme.colors.textMuted}>{likeCount > 0 ? String(likeCount) : 'Like'}</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Comment on ${review.reviewerDisplayName}'s review`} accessibilityState={{ expanded: commentsOpen, disabled: commentBusy }} disabled={commentBusy} onPress={onToggleComments} style={styles.textAction}>
            <AppIcon name="chatbubble-outline" size={16} color={theme.colors.textMuted} />
            <AppText variant="caption" color={theme.colors.textMuted}>{review.commentCount > 0 ? String(review.commentCount) : 'Comment'}</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Unsave review' : 'Save review'} onPress={onToggleSave} style={styles.textAction}>
            <AppText variant="caption" color={theme.colors.socialText}>{saved ? 'Saved' : 'Save'}</AppText>
          </Pressable>
          <View style={styles.reviewReport}><ReportAction targetType="review" targetId={String(review._id)} label="Report review" compact /></View>
        </>
      ) : (
        <AppText variant="caption" color={theme.colors.textMuted}>Sign in to like or comment on this review.</AppText>
      )}
    </View>
    {commentsOpen ? (
      <View style={styles.reviewComments}>
        {review.comments?.map((comment) => (
          <View key={comment._id} style={styles.reviewComment}>
            <Avatar uri={comment.authorProfileImageUrl ?? undefined} name={comment.authorDisplayName} size={24} />
            <View style={styles.reviewCommentCopy}>
              <AppText variant="bodyStrong" numberOfLines={1}>{comment.authorDisplayName}</AppText>
              <AppText variant="body">{comment.body}</AppText>
            </View>
          </View>
        ))}
        {signedIn ? (
          <View style={styles.reviewCommentForm}>
            <TextField
              accessibilityLabel={`Comment on ${review.reviewerDisplayName}'s review`}
              value={commentDraft}
              onChangeText={onChangeCommentDraft}
              placeholder="Write a respectful comment"
              multiline
              maxLength={501}
              editable={!commentBusy}
              style={styles.reviewCommentInput}
            />
            <TextCount count={commentDraft.length} limit={500} />
            <ActionButton label={commentBusy ? 'Posting' : 'Post comment'} onPress={onSubmitComment} intent="social" compact disabled={commentBusy || !commentDraft.trim() || commentDraft.length > 500} />
          </View>
        ) : null}
      </View>
    ) : null}
  </View>
}

function TextCount({ count, limit }: { count: number; limit: number }) {
  const theme = useAppTheme()
  return <AppText variant="caption" color={count > limit ? theme.colors.danger : theme.colors.textMuted} style={styles.textCount}>{count}/{limit}</AppText>
}

function ReviewImage({ url, reviewerName, onOpen }: { url: string; reviewerName: string; onOpen: () => void }) {
  const theme = useAppTheme()
  const DEFAULT_ASPECT = 4 / 3
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)
  const label = `Photo shared with ${reviewerName}'s review`

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label}`} onPress={onOpen} style={({ pressed }) => [styles.reviewImageWrap, pressed && styles.pressed]}>
      <Image
        source={{ uri: url }}
        resizeMode="cover"
        accessibilityLabel={label}
        onLoad={(event) => {
          const { width, height } = event.nativeEvent.source
          if (width > 0 && height > 0) setAspect(width / height)
        }}
        style={[styles.reviewImage, { aspectRatio: aspect, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      />
    </Pressable>
  )
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

function RateHighlight({ value }: { value: string }) {
  const theme = useAppTheme()
  const rate = companionRatePresentation(value)

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Rate ${value}`}
      style={[
        styles.rateCard,
        {
          backgroundColor: theme.colors.surfaceRaised,
          borderColor: theme.colors.border,
          borderLeftColor: theme.colors.social,
        },
      ]}
    >
      <AppText variant="caption" color={theme.colors.textMuted} style={styles.rateLabel}>Hourly rate</AppText>
      <View style={styles.rateLine}>
        <AppText color={theme.colors.socialText} style={styles.rateAmount}>{rate.amount}</AppText>
        {rate.cadence ? <AppText variant="caption" color={theme.colors.textMuted}>{rate.cadence}</AppText> : null}
      </View>
    </View>
  )
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
  profileName: companionProfileTypography.name,
  profileIntro: companionProfileTypography.intro,
  profileBio: companionProfileTypography.bio,
  verified: { width: 9, height: 9, borderRadius: 5 },
  identityMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 3 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  stickyActions: { flexDirection: 'row', gap: 10, width: '100%', maxWidth: 760, alignSelf: 'center' },
  flexAction: { flex: 1, minHeight: 46, paddingHorizontal: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  details: { gap: 12, marginTop: 14 },
  detailRow: { gap: 3 },
  detailValue: { flex: 1 },
  rateCard: { gap: 2, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3, borderRadius: 12 },
  rateLabel: { fontWeight: '700' },
  rateLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  rateAmount: companionProfileTypography.rate,
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
  reviewImageWrap: { width: '100%', overflow: 'hidden', borderRadius: 8 },
  reviewImage: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  reviewActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginTop: 2, minHeight: 34 },
  textAction: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  reviewReport: { flexDirection: 'row', alignItems: 'center', minHeight: 34 },
  reviewComments: { gap: density.cardGap, paddingTop: 2 },
  reviewComment: { flexDirection: 'row', alignItems: 'flex-start', gap: density.cardGap },
  reviewCommentCopy: { flex: 1, minWidth: 0, gap: 1 },
  reviewCommentForm: { gap: density.textStackGap },
  reviewCommentInput: { minHeight: 64, maxHeight: 100 },
  textCount: { alignSelf: 'flex-end' },
  route: { flex: 1 },
  blurTarget: { flex: 1 },
  pressed: { opacity: 0.72 },
  bottomSection: { gap: 10 },
})
