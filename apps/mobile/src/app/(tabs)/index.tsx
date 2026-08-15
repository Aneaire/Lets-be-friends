import type { FunctionReturnType } from 'convex/server'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Image, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { api as generatedApi } from '../../../../web/convex/_generated/api'

import { useMobileAuth } from '@/auth/MobileAuth'
import { mobileApi, type PostMediaUploadId, type StorageId, type UserId } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { ActionButton } from '@/components/ActionButton'
import { Avatar } from '@/components/Avatar'
import { AppIcon } from '@/components/AppIcon'
import { useAppToastMessage } from '@/components/AppToast'
import { Brand } from '@/components/Brand'
import { Chip } from '@/components/Chip'
import { Screen } from '@/components/Screen'
import { SocialFeedCard } from '@/components/SocialFeedCard'
import { StateView } from '@/components/StateView'
import { FeedSkeleton } from '@/components/Skeleton'
import { AppText } from '@/components/Typography'
import { dedupeFeedItems, maximumPostMediaItems, postMediaValidationError } from '@/data/discovery'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type FeedFilter = 'for_you' | 'following' | 'saved'
type FeedItem = FunctionReturnType<typeof generatedApi.social.feedPage>['page'][number]
type FeedAction = 'open_companion' | 'open_guidance' | 'comment' | 'like' | 'save' | 'follow' | 'report' | 'report_comment'

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
  const [filter, setFilter] = useState<FeedFilter>('for_you')
  const signedIn = member.status === 'ready'
  const canQuery = filter === 'for_you' || signedIn
  const feedPage = usePaginatedQuery(generatedApi.social.feedPage, canQuery ? { filter } : 'skip', { initialNumItems: 20 })
  const feedItems = useMemo(() => dedupeFeedItems(feedPage.results), [feedPage.results])
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
  const [authorFollowState, setAuthorFollowState] = useState<Record<string, { following: boolean; busy: boolean }>>({})
  const followRequests = useRef(new Set<string>())

  useEffect(() => {
    impressionKey.current = ''
  }, [filter])

  useEffect(() => {
    if (!signedIn || !feedItems.length) return
    const items = feedItems.slice(-20).map((item, position) => ({ itemKey: item.itemKey, itemType: item.kind, source: item.source, position }))
    const key = `${filter}:${items.map((item) => item.itemKey).join('|')}`
    if (impressionKey.current === key) return
    impressionKey.current = key
    void recordImpressions({ sessionId: sessionId.current, surface: filter, items }).catch(() => undefined)
  }, [feedItems, filter, recordImpressions, signedIn])

  async function publish() {
    const body = postBody.trim()
    if ((!body && mediaAssets.length === 0) || body.length > 1_000 || creating) return
    setCreating(true)
    setPostError('')
    const grantedUploads: Array<{ uploadId: PostMediaUploadId; storageId?: StorageId }> = []
    try {
      if (mediaAssets.length > (mediaUsage?.remaining ?? 0)) throw new Error('Daily media quota reached')
      const preparedAssets = await Promise.all(mediaAssets.map(async (asset) => {
        const source = await fetch(asset.uri)
        if (!source.ok) throw new Error('The selected media could not be read.')
        const blob = await source.blob()
        const mimeType = asset.mimeType || blob.type
        const validationError = postMediaValidationError({ type: asset.type, mimeType, fileSize: blob.size })
        if (validationError) throw new Error(validationError)
        return { blob, mimeType }
      }))
      const uploadIds: PostMediaUploadId[] = []
      for (const prepared of preparedAssets) {
        const grant = await generateMediaUpload({})
        const granted = { uploadId: grant.uploadId as PostMediaUploadId, storageId: undefined as StorageId | undefined }
        grantedUploads.push(granted)
        const upload = await fetch(grant.uploadUrl, { method: 'POST', headers: { 'Content-Type': prepared.mimeType }, body: prepared.blob })
        if (!upload.ok) throw new Error('A media upload failed. No media was attached to your post.')
        const result = await upload.json() as { storageId?: StorageId }
        if (!result.storageId) throw new Error('A media upload was incomplete. No media was attached to your post.')
        granted.storageId = result.storageId
        await registerMediaUpload({ uploadId: granted.uploadId, storageId: result.storageId })
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
    try {
      const remainingQuota = mediaUsage?.remaining
      if (remainingQuota === undefined) {
        setPostError('Checking your remaining community media allowance. Please try again in a moment.')
        return
      }
      const selectionLimit = Math.min(maximumPostMediaItems - mediaAssets.length, remainingQuota)
      if (selectionLimit <= 0) {
        setPostError(mediaAssets.length >= maximumPostMediaItems ? 'Posts can include up to 5 photos or videos.' : 'Your daily community media allowance is used. You can still publish a text post.')
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

  async function updateFollowing(authorId: string, currentFollowing: boolean) {
    if (followRequests.current.has(authorId)) return undefined
    followRequests.current.add(authorId)
    setAuthorFollowState((state) => ({
      ...state,
      [authorId]: { following: state[authorId]?.following ?? currentFollowing, busy: true },
    }))
    try {
      const following = await toggleFollow({ userId: authorId as UserId })
      setAuthorFollowState((state) => ({ ...state, [authorId]: { following, busy: false } }))
      return following
    } finally {
      followRequests.current.delete(authorId)
      setAuthorFollowState((state) => state[authorId]
        ? { ...state, [authorId]: { ...state[authorId], busy: false } }
        : state)
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
  const accountImage = signedIn ? member.viewer.profileImageUrl : auth.status === 'signed_in' ? auth.imageUrl : undefined

  const visibleFeedItems = canQuery ? feedItems : []

  return (
    <Screen scroll={false} contentStyle={styles.listScreen}>
      <FlatList
        data={visibleFeedItems}
        keyExtractor={(item) => item.itemKey}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const authorId = item.kind === 'post' ? String(item.post.authorId) : undefined
          const followState = authorId ? authorFollowState[authorId] : undefined
          const following = item.kind === 'post' ? followState?.following ?? item.post.followingAuthor : undefined
          return <SocialFeedCard item={item} signedIn={signedIn} following={following} followBusy={followState?.busy} onToggleFollow={authorId && following !== undefined ? () => updateFollowing(authorId, following) : undefined} onAction={(action) => instrument(item, action)} />
        }}
        ListHeaderComponent={<>
      <View style={styles.topBar}>
        <View style={styles.titleCopy}><Brand compact /><AppText variant="caption" color={theme.colors.textMuted}>Everyday help, useful ideas, and real connections</AppText></View>
        <View style={styles.topActions}>
          {signedIn ? <Pressable accessibilityRole="button" accessibilityLabel={unread ? `Open notifications, ${unread} unread` : 'Open notifications'} onPress={() => router.push('/notifications')} style={[styles.iconButton, { borderColor: theme.colors.border }]}><AppIcon name={unread ? 'notifications' : 'notifications-outline'} color={theme.colors.text} />{unread ? <View style={[styles.badge, { backgroundColor: theme.colors.socialControl }]}><AppText variant="caption" color={theme.colors.accentText}>{unread > 99 ? '99+' : unread}</AppText></View> : null}</Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.navigate('/profile')} style={styles.profileButton}><Avatar uri={accountImage} name={accountName ?? 'Account'} size={42} /></Pressable>
        </View>
      </View>

      {signedIn ? (
        <View style={[styles.composer, composerOpen && styles.composerOpen, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}> 
          {!composerOpen ? <View style={styles.collapsedComposer}>
            <Pressable accessibilityRole="button" accessibilityLabel="Create a post" onPress={() => setComposerOpen(true)} style={[styles.composerPrompt, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><AppText color={theme.colors.textMuted} numberOfLines={1}>What could feel easier together?</AppText></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Add photos or videos" onPress={() => { setComposerOpen(true); void chooseMedia() }} disabled={creating || mediaUsage?.remaining === 0} style={({ pressed }) => [styles.compactMediaButton, { borderColor: theme.colors.border }, pressed && styles.pressed]}><AppIcon name="images-outline" color={theme.colors.socialText} /></Pressable>
          </View> : <View style={styles.composerCopy}>
            <TextInput
              accessibilityLabel="Create a text post"
              value={postBody}
              onChangeText={(value) => { setPostBody(value); setPostError('') }}
              placeholder="Ask for help, share an idea, or start a conversation"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              maxLength={1_001}
              style={[styles.postInput, theme.typography.body, { color: theme.colors.text, borderColor: postBody.length > 1_000 ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.background }]}
              autoFocus
            />
            {mediaAssets.length ? <View style={styles.mediaGrid}>{mediaAssets.map((asset, index) => <View key={asset.assetId ?? asset.uri} style={[styles.mediaPreview, { borderColor: theme.colors.border }]}>{asset.type === 'image' ? <Image source={{ uri: asset.uri }} accessibilityLabel={`Selected post photo ${index + 1}`} style={styles.previewImage} /> : <View style={styles.videoPreview}><AppIcon name="videocam-outline" color={theme.colors.socialText} /><AppText variant="caption">Video {index + 1} ready</AppText></View>}<Pressable accessibilityRole="button" accessibilityLabel={`Remove selected media ${index + 1}`} onPress={() => setMediaAssets((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={[styles.removeMedia, { backgroundColor: theme.colors.inverse }]}><AppIcon name="close" color={theme.colors.inverseText} size={18} /></Pressable></View>)}</View> : null}
            <View style={styles.publishRow}><Pressable accessibilityRole="button" accessibilityLabel="Add photos or videos" onPress={() => void chooseMedia()} disabled={creating || mediaAssets.length >= maximumPostMediaItems || mediaUsage?.remaining === 0} style={styles.mediaButton}><AppIcon name="images-outline" color={theme.colors.socialText} /><AppText variant="caption" color={theme.colors.socialText}>Photos or videos</AppText></Pressable>{composerOpen ? <><AppText variant="caption" color={postBody.length > 1_000 ? theme.colors.danger : theme.colors.textMuted}>{postBody.length}/1,000</AppText><ActionButton label={creating ? 'Posting' : 'Post'} onPress={() => void publish()} disabled={creating || (!postBody.trim() && mediaAssets.length === 0) || postBody.length > 1_000} style={styles.postButton} /></> : null}</View>
            {composerOpen && mediaUsage ? <AppText variant="caption" color={theme.colors.textMuted}>{mediaAssets.length}/5 selected, {mediaUsage.remaining} media uploads remaining today</AppText> : null}
          </View>}
        </View>
      ) : (
        <View style={[styles.signInCard, { borderColor: theme.colors.border }]}><AppText variant="bodyStrong">Join the conversation</AppText><AppText variant="caption" color={theme.colors.textMuted}>{auth.status === 'unconfigured' ? 'Account services are not configured in this build. Public For You activity remains read only.' : 'Sign in to post, follow, save, comment, and shape your feed.'}</AppText>{auth.status === 'signed_out' ? <ActionButton label="Sign in" onPress={() => router.push('/auth')} secondary /> : null}</View>
      )}

      <View style={styles.filters}>
        <Chip label="For you" selected={filter === 'for_you'} onPress={() => setFilter('for_you')} />
        <Chip label="Following" selected={filter === 'following'} onPress={() => setFilter('following')} />
        <Chip label="Saved" selected={filter === 'saved'} onPress={() => setFilter('saved')} />
      </View>
        </>}
        ListEmptyComponent={!canQuery
          ? <StateView embedded title={`Sign in to view ${filter}`} detail="This feed uses your real account relationships and saved posts." actionLabel={auth.status === 'signed_out' ? 'Sign in' : undefined} onAction={auth.status === 'signed_out' ? () => router.push('/auth') : undefined} />
          : feedPage.status === 'LoadingFirstPage'
            ? <View><FeedSkeleton /><FeedSkeleton /></View>
            : <StateView embedded title={filter === 'following' ? 'No posts from followed members yet' : filter === 'saved' ? 'No saved posts yet' : 'No community posts yet'} detail={filter === 'for_you' ? 'Approved Companion recommendations and guidance appear when available.' : 'Use For You and Explore to find people and posts that matter to you.'} />}
        ListFooterComponent={feedPage.status === 'CanLoadMore' ? <View style={styles.loadMore}><ActionButton label="Load more updates" onPress={() => feedPage.loadMore(20)} intent="social" secondary /></View> : feedPage.status === 'LoadingMore' ? <View style={styles.loadMore}><AppText variant="caption" color={theme.colors.textMuted}>Loading more updates.</AppText></View> : null}
      />
    </Screen>
  )
}

function HomeState({ title, detail }: { title: string; detail?: string }) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="HOME" title={title} detail={detail} /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="HOME" title="Home is temporarily unavailable" detail="No social action was taken." actionLabel="Try again" onAction={retry} /></Screen>
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  listScreen: { paddingHorizontal: 0, paddingBottom: 0 },
  listContent: { paddingHorizontal: 16, paddingBottom: 48 },
  separator: { height: 10 },
  loadMore: { paddingTop: 18 },
  state: { paddingHorizontal: 16 },
  topBar: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titleCopy: { flex: 1, gap: 1 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { position: 'relative', width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  profileButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  composer: { borderWidth: 1, borderRadius: 14, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  composerOpen: { padding: 12, alignItems: 'flex-start', gap: 10, marginTop: 10 },
  collapsedComposer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  composerCopy: { flex: 1, gap: 7 },
  composerPrompt: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, justifyContent: 'center' },
  compactMediaButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.68 },
  postInput: { minHeight: 48, maxHeight: 120, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingTop: 11, textAlignVertical: 'top' },
  publishRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  mediaButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaPreview: { width: '48%', borderWidth: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', aspectRatio: 4 / 3 },
  videoPreview: { minHeight: 80, alignItems: 'center', justifyContent: 'center', gap: 5 },
  removeMedia: { position: 'absolute', right: 8, top: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  postButton: { minHeight: 44, paddingHorizontal: 18 },
  signInCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8, marginTop: 10 },
  filters: { flexDirection: 'row', gap: 8, marginVertical: 16 },
  feed: { gap: 10 },
})
