import type { FunctionReturnType } from 'convex/server'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { BlurTargetView } from 'expo-blur'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native'
import { activeMentionQuery } from '@lets-be-friends/shared'

import { useMobileAuth } from '@/auth/MobileAuth'
import { mobileApi, type PostMediaUploadId, type StorageId, type UserId } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Avatar } from '@/design-system/atoms/Avatar'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { Brand, BRAND_TAGLINE } from '@/design-system/atoms/Brand'
import { SegmentedControl } from '@/design-system/molecules/SegmentedControl'
import { Screen } from '@/design-system/templates/Screen'
import { PostComposer } from '@/features/social/PostComposer'
import { emptyPollDraft } from '@/features/social/PollComposer'
import { canPublishFeedPost, feedComposerValidationError, feedPostPollPayload, mediaPickerSelectionLimit } from '@/features/social/feedComposer'
import { homeFeedQueryArgs, feedLoadMoreKey, shouldRequestFeedLoadMore, syncFeedPageRequestState, type FeedPageRequestState } from '@/features/social/feedPagination'
import { HomeFeedLoadingScreen } from '@/features/social/HomeFeedLoadingScreen'
import { SocialFeedCard } from '@/features/social/SocialFeedCard'
import { PostImageViewer, type PostViewerImage } from '@/features/social/PostImageViewer'
import { homeAccountPresentation } from '@/features/social/homePresentation'
import { preparePostMedia, uploadPostMedia } from '@/features/social/postMediaUpload'
import { StateView } from '@/design-system/molecules/StateView'
import { FeedSkeleton } from '@/design-system/atoms/Skeleton'
import { AppText } from '@/design-system/atoms/Typography'
import { dedupeFeedItems, maximumPostMediaItems, postMediaValidationError } from '@/data/discovery'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type FeedFilter = 'for_you' | 'following' | 'saved'
type FeedItem = FunctionReturnType<typeof mobileApi.social.feedPage>['page'][number]

const feedFilterOptions = [
  { value: 'for_you', label: 'For you' },
  { value: 'following', label: 'Following' },
  { value: 'saved', label: 'Saved' },
] satisfies Array<{ value: FeedFilter; label: string }>
type FeedAction = 'open_companion' | 'open_guidance' | 'open_review' | 'comment' | 'like' | 'save' | 'share' | 'follow' | 'report' | 'report_comment'

export default function HomeScreen() {
  const backend = useMobileBackendConfiguration()
  if (backend.status !== 'configured') {
    return <HomeState title="Home needs member services" detail="This build cannot connect to community activity." />
  }
  return <ConnectedHome />
}

function ConnectedHome() {
  const theme = useAppTheme()
  const auth = useMobileAuth()
  const member = useMobileMember()
  const params = useLocalSearchParams<{ postId?: string }>()
  const requestedPostId = typeof params.postId === 'string' ? params.postId : ''
  const [filter, setFilter] = useState<FeedFilter>('for_you')
  const signedIn = member.status === 'ready'
  const accountPresentation = homeAccountPresentation(auth.status, member.status)
  const accountLoading = accountPresentation === 'account_loading'
  const canQuery = signedIn
  const feedPage = usePaginatedQuery(mobileApi.social.feedPage, homeFeedQueryArgs(filter, signedIn), { initialNumItems: 20 })
  const feedItems = useMemo(() => dedupeFeedItems(feedPage.results), [feedPage.results])
  const requestedPost = useQuery(mobileApi.social.requestedPost, requestedPostId ? { postId: requestedPostId } : 'skip')
  const unread = useQuery(mobileApi.notifications.unreadCount, signedIn ? {} : 'skip') ?? 0
  const mediaUsage = useQuery(mobileApi.social.mediaUploadUsage, signedIn ? {} : 'skip')
  const recordImpressions = useMutation(mobileApi.social.recordFeedImpressions)
  const recordAction = useMutation(mobileApi.social.recordFeedAction)
  const createPost = useMutation(mobileApi.social.createPost)
  const generateMediaUpload = useMutation(mobileApi.social.generatePostMediaUploadUrl)
  const registerMediaUpload = useMutation(mobileApi.social.registerPostMediaUpload)
  const discardMediaUpload = useMutation(mobileApi.social.discardPostMediaUpload)
  const toggleFollow = useMutation(mobileApi.social.toggleFollow)
  const sessionId = useRef(`mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
  const impressionKey = useRef('')
  const [creating, setCreating] = useState(false)
  const [postBody, setPostBody] = useState('')
  const [postError, setPostError] = useState('')
  useAppToastMessage(postError)
  const [composerOpen, setComposerOpen] = useState(false)
  const [mediaAssets, setMediaAssets] = useState<ImagePicker.ImagePickerAsset[]>([])
  const [pollOpen, setPollOpen] = useState(false)
  const [pollDraft, setPollDraft] = useState(emptyPollDraft)
  const blurTarget = useRef<View>(null)
  const [viewerImage, setViewerImage] = useState<PostViewerImage | null>(null)
  const [mentionCaret, setMentionCaret] = useState(0)
  const mentionToken = activeMentionQuery(postBody, mentionCaret)
  const mentionSuggestions = useQuery(mobileApi.social.mentionLookup, mentionToken ? { query: mentionToken } : 'skip')
  const [authorFollowBusy, setAuthorFollowBusy] = useState<Record<string, boolean>>({})
  const followRequests = useRef(new Set<string>())
  const feedQueryKey = `${filter}:${member.status === 'ready' ? String(member.viewer._id) : 'signed-out'}`
  const feedPageRequest = useRef<FeedPageRequestState>({ queryKey: feedQueryKey, inFlightKey: null, observedLoading: false })
  const feedScrollStarted = useRef(false)

  useEffect(() => {
    impressionKey.current = ''
    feedScrollStarted.current = false
  }, [feedQueryKey])

  useEffect(() => {
    feedPageRequest.current = syncFeedPageRequestState(feedPageRequest.current, {
      queryKey: feedQueryKey,
      status: feedPage.status,
    })
  }, [feedPage.status, feedQueryKey])

  useEffect(() => {
    if (!signedIn || !feedItems.length) return
    const items = feedItems.slice(-20).map((item, position) => ({ itemKey: item.itemKey, itemType: item.kind, source: item.source, position }))
    const key = `${filter}:${items.map((item) => item.itemKey).join('|')}`
    if (impressionKey.current === key) return
    impressionKey.current = key
    void recordImpressions({ sessionId: sessionId.current, surface: filter, items }).catch(() => undefined)
  }, [feedItems, filter, recordImpressions, signedIn])

  function togglePoll() {
    if (creating) return
    setPostError('')
    // Polls are text-only, so opening a poll discards staged media just like
    // the website composer clears its selection when a poll is added.
    if (!pollOpen) setMediaAssets([])
    setPollOpen(!pollOpen)
  }

  async function publish() {
    const body = postBody.trim()
    const draft = { body: postBody, mediaCount: mediaAssets.length, pollOpen, pollDraft }
    const composerError = feedComposerValidationError(draft)
    if (creating || !canPublishFeedPost(draft, creating)) {
      if (composerError) setPostError(composerError)
      return
    }
    setCreating(true)
    setPostError('')
    const grantedUploads: Array<{ uploadId: PostMediaUploadId; storageId?: StorageId }> = []
    try {
      if (pollOpen) {
        // Poll-only publishing: no media uploads are granted, so a poll post
        // can never carry photos or video.
        await createPost({ body, poll: feedPostPollPayload(draft) })
        setPostBody('')
        setPollDraft(emptyPollDraft())
        setPollOpen(false)
        setComposerOpen(false)
        return
      }
      if (mediaAssets.length > (mediaUsage?.remaining ?? 0)) throw new Error('Daily media quota reached')
      const preparedAssets = await Promise.all(mediaAssets.map(async (asset) => {
        const prepared = await preparePostMedia(asset)
        const validationError = postMediaValidationError({ type: asset.type, mimeType: prepared.mimeType, fileSize: prepared.fileSize })
        if (validationError) throw new Error(validationError)
        return prepared
      }))
      const uploadIds: PostMediaUploadId[] = []
      for (const prepared of preparedAssets) {
        const grant = await generateMediaUpload({})
        const granted = { uploadId: grant.uploadId, storageId: undefined as StorageId | undefined }
        grantedUploads.push(granted)
        const storageId = await uploadPostMedia(grant.uploadUrl, prepared) as StorageId
        granted.storageId = storageId
        await registerMediaUpload({ uploadId: granted.uploadId, storageId })
        uploadIds.push(granted.uploadId)
      }
      await createPost({ body, mediaUploadIds: uploadIds.length ? uploadIds : undefined })
      setPostBody('')
      setMediaAssets([])
      setComposerOpen(false)
    } catch (error) {
      await Promise.all(grantedUploads.map(({ uploadId, storageId }) => discardMediaUpload({ uploadId, storageId }).catch(() => undefined)))
      const message = error instanceof Error ? error.message : ''
      setPostError(message.includes('quota') || message.includes('limit reached')
        ? 'Your daily community media allowance is used. You can publish without media or try again tomorrow.'
        : message || 'Your post could not be published. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function chooseMedia() {
    if (creating) return
    setPostError('')
    if (pollOpen) {
      setPostError('Polls cannot include photos or video. Remove the poll to add media.')
      return
    }
    try {
      const remainingQuota = mediaUsage?.remaining
      if (remainingQuota === undefined) {
        setPostError('Checking your remaining community media allowance. Please try again in a moment.')
        return
      }
      const selectionLimit = mediaPickerSelectionLimit({ selected: mediaAssets.length, remaining: remainingQuota, limit: maximumPostMediaItems })
      if (selectionLimit <= 0) {
        setPostError(mediaAssets.length > 0 && mediaAssets.length === remainingQuota
            ? 'You have selected all media available in your daily allowance. You can publish this selection or remove an item to choose another.'
            : mediaAssets.length > remainingQuota
              ? 'Your remaining media allowance changed. Remove media until the selection fits before publishing.'
              : mediaAssets.length >= maximumPostMediaItems
                ? 'Posts can include up to 5 photos or videos.'
                : 'Your daily community media allowance is used. You can still publish a text post.')
        return
      }
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false)
        if (!permission.granted) {
          setPostError('Photo access lets you choose a profile photo, community post media, or optional booking evidence.')
          return
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsEditing: false, allowsMultipleSelection: true, selectionLimit, quality: 0.9, videoMaxDuration: 60 })
      const selected = result.canceled ? [] : result.assets.slice(0, selectionLimit)
      const invalid = selected.map((asset) => postMediaValidationError({ type: asset.type, mimeType: asset.mimeType, fileSize: asset.fileSize })).find(Boolean)
      if (invalid) {
        setPostError(invalid)
        return
      }
      if (selected.length) {
        setMediaAssets((current) => [...current, ...selected].slice(0, maximumPostMediaItems))
        setComposerOpen(true)
      }
    } catch {
      setPostError('Your media library could not be opened. Please try again.')
    }
  }

  function insertMention(username: string) {
    const before = postBody.slice(0, mentionCaret).replace(/@[a-z0-9_]*$/i, `@${username} `)
    const after = postBody.slice(mentionCaret)
    const next = before + after
    setPostBody(next)
    setMentionCaret(before.length)
  }

  async function updateFollowing(authorId: UserId) {
    const requestKey = String(authorId)
    if (followRequests.current.has(requestKey)) return undefined
    followRequests.current.add(requestKey)
    setAuthorFollowBusy((state) => ({ ...state, [requestKey]: true }))
    try {
      return await toggleFollow({ userId: authorId })
    } finally {
      followRequests.current.delete(requestKey)
      setAuthorFollowBusy((state) => {
        if (!state[requestKey]) return state
        const next = { ...state }
        delete next[requestKey]
        return next
      })
    }
  }

  function instrument(item: FeedItem, action: FeedAction) {
    if (!signedIn) return
    void recordAction({
      sessionId: sessionId.current,
      surface: filter,
      itemKey: item.itemKey,
      itemType: item.kind,
      source: item.source,
      action,
    }).catch(() => undefined)
  }

  const accountName = signedIn ? member.viewer.displayName : auth.status === 'signed_in' ? auth.displayName : undefined
  const accountImage = signedIn ? member.viewer.profileImageUrl : undefined

  const visibleFeedItems = useMemo(() => {
    if (!canQuery) return []
    if (!requestedPost || !requestedPostId) return feedItems
    const focusedItem = {
      kind: 'post' as const,
      itemKey: `post:${requestedPost._id}`,
      source: 'recent' as const,
      reason: 'Opened from notification',
      post: requestedPost,
    } as FeedItem
    return dedupeFeedItems([focusedItem, ...feedItems])
  }, [canQuery, feedItems, requestedPost, requestedPostId])

  if (accountLoading) return <HomeFeedLoadingScreen />

  function loadMoreFeed(source: 'viewport' | 'manual') {
    if (source === 'viewport' && (!feedScrollStarted.current || feedPageRequest.current.queryKey !== feedQueryKey)) return
    const loadMoreKey = feedLoadMoreKey(filter, feedItems.length)
    const requestState = syncFeedPageRequestState(feedPageRequest.current, { queryKey: feedQueryKey, status: feedPage.status })
    feedPageRequest.current = requestState
    if (!shouldRequestFeedLoadMore({
      status: feedPage.status,
      canQuery,
      loadMoreKey,
      lastRequestedKey: requestState.inFlightKey,
    })) return
    feedPageRequest.current = { ...requestState, inFlightKey: loadMoreKey, observedLoading: false }
    feedPage.loadMore(20)
  }

  return (
    <View style={styles.route}>
      <BlurTargetView
        ref={blurTarget}
        importantForAccessibility={viewerImage ? 'no-hide-descendants' : 'auto'}
        style={styles.blurTarget}
      >
        <Screen scroll={false} contentStyle={styles.listScreen}>
          <FlatList
            data={visibleFeedItems}
            keyExtractor={(item) => item.itemKey}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            onScrollBeginDrag={() => { feedScrollStarted.current = true }}
            onEndReached={() => loadMoreFeed('viewport')}
            onEndReachedThreshold={0.5}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const authorId = item.kind === 'post' ? item.post.authorId : undefined
              const following = item.kind === 'post' ? item.post.followingAuthor : undefined
              const authorKey = authorId ? String(authorId) : undefined
              return <SocialFeedCard item={item} signedIn={signedIn} following={following} followBusy={authorKey ? Boolean(authorFollowBusy[authorKey]) : false} onToggleFollow={authorId && following !== undefined ? () => updateFollowing(authorId) : undefined} onOpenImage={setViewerImage} onAction={(action) => instrument(item, action)} />
            }}
        ListHeaderComponent={<>
      <View style={styles.topBar}>
        <View style={styles.titleCopy}><Brand size="sm" /><AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{BRAND_TAGLINE}</AppText></View>
        <View style={styles.topActions}>
          {signedIn ? <Pressable accessibilityRole="button" accessibilityLabel={unread ? `Open notifications, ${unread} unread` : 'Open notifications'} onPress={() => router.push('/notifications')} style={[styles.iconButton, { borderColor: theme.colors.border }]}><AppIcon name={unread ? 'notifications' : 'notifications-outline'} color={theme.colors.text} />{unread ? <View style={[styles.badge, { backgroundColor: theme.colors.socialControl }]}><AppText variant="caption" color={theme.colors.accentText}>{unread > 99 ? '99+' : unread}</AppText></View> : null}</Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.navigate('/profile')} style={styles.profileButton}><Avatar uri={accountImage} name={accountName ?? 'Account'} size={38} /></Pressable>
        </View>
      </View>

      {signedIn ? (
        <PostComposer
          expanded={composerOpen}
          avatarUri={accountImage}
          avatarName={accountName}
          body={postBody}
          busy={creating}
          media={mediaAssets.map((asset) => ({
            key: asset.assetId ?? asset.uri,
            kind: asset.type === 'image' ? 'image' : 'video',
            previewUrl: asset.type === 'image' ? asset.uri : undefined,
          }))}
          mediaLimit={maximumPostMediaItems}
          remainingUploads={mediaUsage?.remaining}
          mentionSuggestions={mentionToken ? mentionSuggestions ?? [] : []}
          pollOpen={pollOpen}
          pollDraft={pollDraft}
          onPollChange={(next) => {
            setPollDraft(next)
            setPostError('')
          }}
          onTogglePoll={togglePoll}
          onExpand={() => setComposerOpen(true)}
          onBodyChange={(value) => {
            setPostBody(value)
            setPostError('')
          }}
          onCaretChange={setMentionCaret}
          onChooseMedia={() => void chooseMedia()}
          onRemoveMedia={(index) => setMediaAssets((current) => current.filter((_, itemIndex) => itemIndex !== index))}
          onSelectMention={insertMention}
          onPublish={() => void publish()}
        />
      ) : null}

      <SegmentedControl
        label="Community feed"
        options={feedFilterOptions}
        value={filter}
        onChange={setFilter}
        tone="social"
        style={styles.feedFilter}
      />
        </>}
        ListEmptyComponent={feedPage.status === 'LoadingFirstPage'
          ? <View style={styles.skeletonList}><FeedSkeleton /><FeedSkeleton /><FeedSkeleton /></View>
          : <StateView embedded title={filter === 'following' ? 'No posts from followed members yet' : filter === 'saved' ? 'No saved posts yet' : 'No community posts yet'} detail={filter === 'for_you' ? 'Approved Companion recommendations and guidance appear when available.' : 'Use For You and Explore to find people and posts that matter to you.'} />}
        ListFooterComponent={feedPage.status === 'CanLoadMore' ? <View style={styles.loadMore}><ActionButton label="Load more updates" onPress={() => loadMoreFeed('manual')} intent="social" secondary /></View> : feedPage.status === 'LoadingMore' ? <View style={styles.loadMore}><AppText variant="caption" color={theme.colors.textMuted}>Loading more updates.</AppText></View> : feedPage.status === 'Exhausted' && visibleFeedItems.length > 0 ? <View style={styles.loadMore}><AppText variant="caption" color={theme.colors.textMuted}>You are caught up.</AppText></View> : null}
          />
        </Screen>
      </BlurTargetView>
      <PostImageViewer image={viewerImage} blurTarget={blurTarget} onClose={() => setViewerImage(null)} />
    </View>
  )
}

function HomeState({ title, detail }: { title: string; detail?: string }) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="HOME" title={title} detail={detail} /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="HOME" title="Home is temporarily unavailable" detail="No social action was taken." actionLabel="Try again" onAction={retry} /></Screen>
}

const styles = StyleSheet.create({
  route: { flex: 1 },
  blurTarget: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  listScreen: { paddingHorizontal: 0, paddingBottom: 0 },
  listContent: { paddingHorizontal: 14, paddingBottom: 32 },
  separator: { height: 8 },
  loadMore: { paddingTop: 18 },
  state: { paddingHorizontal: 16 },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleCopy: { flex: 1, minWidth: 0, gap: 1 },
  topActions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 4 },
  iconButton: { position: 'relative', width: 44, height: 44, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  profileButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  feedFilter: { marginVertical: 10 },
  skeletonList: { gap: 8 },
  feed: { gap: 10 },
})
