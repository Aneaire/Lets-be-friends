import type { FunctionReturnType } from 'convex/server'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { useState } from 'react'
import { Alert, FlatList, Image, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { api as generatedApi } from '../../../web/convex/_generated/api'
import { activeMentionQuery, splitBodyIntoSegments, type StoredMention } from '@lets-be-friends/shared'

import { mobileApi, type PostId } from '@/backend/client'
import { formatMessageTimestamp } from '@/data/messageViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from './ActionButton'
import { AppIcon, type AppIconName } from './AppIcon'
import { useAppToastMessage } from './AppToast'
import { Avatar } from './Avatar'
import { ReportAction } from './ReportAction'
import { AppText } from './Typography'

type FeedItem = FunctionReturnType<typeof generatedApi.social.feedPage>['page'][number]
type FeedAction = 'open_companion' | 'open_guidance' | 'comment' | 'like' | 'save' | 'follow' | 'report' | 'report_comment'
type PostMedia = { storageId: string; kind: string; url?: string | null }

function MentionBody({ body, mentions, numberOfLines }: { body: string; mentions?: StoredMention[]; numberOfLines?: number }) {
  const theme = useAppTheme()
  const segments = splitBodyIntoSegments(body, mentions ?? [])
  return (
    <AppText numberOfLines={numberOfLines}>
      {segments.map((segment, index) => segment.type === 'mention' ? (
        <AppText key={index} accessibilityRole="link" onPress={() => openMemberProfile(segment.userId)} variant="bodyStrong" color={theme.colors.socialText}>@{segment.username}</AppText>
      ) : (
        <AppText key={index}>{segment.text}</AppText>
      ))}
    </AppText>
  )
}

export function SocialFeedCard({ item, signedIn, following, followBusy = false, onToggleFollow, onAction }: {
  item: FeedItem
  signedIn: boolean
  following?: boolean
  followBusy?: boolean
  onToggleFollow?: (authorId: string) => Promise<boolean | undefined>
  onAction: (action: FeedAction) => void
}) {
  if (item.kind === 'companion') return <CompanionRecommendation item={item} onAction={onAction} />
  if (item.kind === 'guidance') return <GuidanceCard item={item} onAction={onAction} />
  return <PostCard item={item} signedIn={signedIn} following={following ?? item.post.followingAuthor} followBusy={followBusy} onToggleFollow={onToggleFollow} onAction={onAction} />
}

function CompanionRecommendation({ item, onAction }: { item: Extract<FeedItem, { kind: 'companion' }>; onAction: (action: FeedAction) => void }) {
  const theme = useAppTheme()
  const companion = item.companion
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open Companion profile for ${companion.displayName}`}
      onPress={() => { onAction('open_companion'); router.push({ pathname: '/companion-profile/[id]', params: { id: String(companion._id) } }) }}
      style={({ pressed }) => [styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }, pressed && styles.pressed]}>
      <AppText variant="caption" color={theme.colors.socialText}>{item.reason}</AppText>
      <View style={styles.identity}><Avatar name={companion.displayName} size={48} /><View style={styles.identityCopy}><AppText variant="bodyStrong">{companion.displayName}</AppText><AppText variant="caption" color={theme.colors.textMuted}>{companion.mode === 'both' ? 'Online and in person' : companion.mode === 'online' ? 'Online sessions' : 'In-person sessions'}</AppText></View></View>
      <AppText>{companion.intro}</AppText>
      <AppText variant="caption" color={theme.colors.socialText}>{companion.strengths.join(' · ')}</AppText>
      <AppText variant="caption" color={theme.colors.textMuted}>{companion.reviewCount ? `★ ${companion.rating.toFixed(1)} from ${companion.reviewCount} reviews` : 'New Companion'}</AppText>
    </Pressable>
  )
}

function GuidanceCard({ item, onAction }: { item: Extract<FeedItem, { kind: 'guidance' }>; onAction: (action: FeedAction) => void }) {
  const theme = useAppTheme()
  return <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}><AppText variant="caption" color={theme.colors.socialText}>{item.reason}</AppText><AppText variant="heading">{item.title}</AppText><AppText color={theme.colors.textMuted}>{item.body}</AppText><ActionButton label={item.actionLabel} onPress={() => { onAction('open_guidance'); router.push('/explore') }} secondary /></View>
}

function PostCard({ item, signedIn, following, followBusy, onToggleFollow, onAction }: {
  item: Extract<FeedItem, { kind: 'post' }>
  signedIn: boolean
  following: boolean
  followBusy: boolean
  onToggleFollow?: (authorId: string) => Promise<boolean | undefined>
  onAction: (action: FeedAction) => void
}) {
  const theme = useAppTheme()
  const post = item.post
  const toggleLike = useMutation(mobileApi.social.toggleLike)
  const toggleSave = useMutation(mobileApi.social.toggleSavePost)
  const editPost = useMutation(mobileApi.social.editPost)
  const deletePost = useMutation(mobileApi.social.deletePost)
  const [liked, setLiked] = useState(post.liked)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [saved, setSaved] = useState(post.saved)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(post.body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useAppToastMessage(error)

  async function like() {
    if (!signedIn || busy) return
    setBusy(true)
    try {
      const next = await toggleLike({ postId: post._id as PostId })
      setLiked(next)
      setLikeCount((count: number) => Math.max(0, count + (next ? 1 : -1)))
      onAction('like')
    } catch {
      setError('Like could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!signedIn || busy) return
    setBusy(true)
    try {
      setSaved(await toggleSave({ postId: post._id as PostId }))
      onAction('save')
    } catch {
      setError('Saved posts could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  async function follow() {
    if (!signedIn || busy || followBusy || post.ownPost || !onToggleFollow) return
    setBusy(true)
    try {
      const next = await onToggleFollow(String(post.authorId))
      if (next !== undefined) onAction('follow')
    } catch {
      setError('Following could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  async function openVideo(url: string) {
    setError('')
    try {
      await Linking.openURL(url)
    } catch {
      setError('This post video could not be opened safely.')
    }
  }

  async function saveEdit() {
    if (busy || editBody.trim().length > 1_000 || (!editBody.trim() && post.media.length === 0)) return
    setBusy(true)
    setError('')
    try {
      await editPost({ postId: post._id as PostId, body: editBody })
      setEditing(false)
    } catch {
      setError('This post could not be edited.')
    } finally {
      setBusy(false)
    }
  }

  function confirmDelete() {
    Alert.alert('Delete this post?', 'The post will be removed from member feeds.', [
      { text: 'Keep post', style: 'cancel' },
      { text: 'Delete post', style: 'destructive', onPress: () => void deletePost({ postId: post._id as PostId }).catch(() => setError('This post could not be deleted.')) },
    ])
  }

  function openPostOptions() {
    setOwnerMenuOpen(true)
  }

  function editFromOptions() {
    setOwnerMenuOpen(false)
    setEditing(true)
  }

  function deleteFromOptions() {
    setOwnerMenuOpen(false)
    setTimeout(confirmDelete, 220)
  }

  return (
    <View style={[styles.card, styles.postCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
      <View style={styles.identity}>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${post.authorDisplayName}'s profile`} onPress={() => openMemberProfile(String(post.authorId), post.authorCompanionProfileId ? String(post.authorCompanionProfileId) : undefined)} style={({ pressed }) => pressed && styles.pressed}>
          <Avatar uri={post.authorProfileImageUrl} name={post.authorDisplayName} size={44} />
        </Pressable>
        <View style={styles.identityCopy}>
          <View style={styles.authorRow}><Pressable accessibilityRole="button" accessibilityLabel={`View ${post.authorDisplayName}'s profile`} onPress={() => openMemberProfile(String(post.authorId), post.authorCompanionProfileId ? String(post.authorCompanionProfileId) : undefined)} style={({ pressed }) => [styles.authorLink, pressed && styles.pressed]}><AppText variant="bodyStrong">{post.authorDisplayName}</AppText></Pressable>{signedIn && !post.ownPost ? <Pressable accessibilityRole="button" accessibilityLabel={following ? `Unfollow ${post.authorDisplayName}` : `Follow ${post.authorDisplayName}`} accessibilityState={{ disabled: followBusy }} disabled={followBusy} onPress={() => void follow()} style={styles.smallAction}><AppText variant="caption" color={followBusy ? theme.colors.textMuted : theme.colors.socialText}>{following ? 'Following' : 'Follow'}</AppText></Pressable> : null}</View>
          <AppText variant="caption" color={theme.colors.textMuted}>{formatMessageTimestamp(post.createdAt)}</AppText>
        </View>
        {post.ownPost ? <Pressable accessibilityRole="button" accessibilityLabel="Post options" onPress={openPostOptions} hitSlop={4} style={({ pressed }) => [styles.optionsButton, pressed && styles.pressed]}><AppIcon name="ellipsis-horizontal" color={theme.colors.text} size={21} /></Pressable> : null}
      </View>
      {post.body ? <MentionBody body={post.body} mentions={post.mentions} /> : null}
      {post.media.filter((media: PostMedia) => media.kind === 'image' && media.url).map((media: PostMedia, index: number) => <Image key={`${media.storageId}-${index}`} source={{ uri: media.url as string }} resizeMode="cover" style={styles.image} accessibilityLabel="Post image" />)}
      {post.media.filter((media: PostMedia) => media.kind === 'video' && media.url).map((media: PostMedia, index: number) => <Pressable key={`${media.storageId}-video-${index}`} accessibilityRole="link" accessibilityLabel="Open post video" onPress={() => void openVideo(media.url as string)} style={[styles.videoLink, { borderColor: theme.colors.border }]}><AppText variant="bodyStrong" color={theme.colors.socialText}>Open post video</AppText><AppText variant="caption" color={theme.colors.textMuted}>Opens through your device's supported video app</AppText></Pressable>)}
      <View style={[styles.counts, { borderBottomColor: theme.colors.border }]}><AppText variant="caption" color={theme.colors.textMuted}>{likeCount} likes</AppText><AppText variant="caption" color={theme.colors.textMuted}>{post.commentCount} comments</AppText></View>
      <View style={styles.actions}>
        <PostAction label={liked ? 'Unlike post' : 'Like post'} icon={liked ? 'heart' : 'heart-outline'} active={liked} disabled={!signedIn || busy} onPress={() => void like()} />
        <PostAction label="Comment on post" icon="chatbubble-outline" onPress={() => { setCommentsOpen(true); onAction('comment') }} />
        <PostAction label={saved ? 'Remove post from saved' : 'Save post'} icon={saved ? 'bookmark' : 'bookmark-outline'} active={saved} disabled={!signedIn || busy} onPress={() => void save()} />
      </View>
      {!post.ownPost && signedIn ? <ReportAction targetType="post" targetId={String(post._id)} label="Report post" compact onReported={() => onAction('report')} /> : null}
      <Modal visible={ownerMenuOpen} transparent animationType="fade" onRequestClose={() => setOwnerMenuOpen(false)}>
        <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}> 
          <Pressable accessibilityRole="button" accessibilityLabel="Close post options" onPress={() => setOwnerMenuOpen(false)} style={styles.backdropDismiss} />
          <View style={[styles.optionSheet, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}> 
            <View style={[styles.optionHandle, { backgroundColor: theme.colors.borderStrong }]} />
            <View style={styles.optionHeader}><AppText variant="heading">Your post</AppText><AppText variant="caption" color={theme.colors.textMuted}>Choose what you want to change.</AppText></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Edit post" onPress={editFromOptions} style={({ pressed }) => [styles.optionRow, { borderColor: theme.colors.border }, pressed && styles.pressed]}>
              <View style={[styles.optionIcon, { backgroundColor: theme.colors.socialSoft }]}><AppIcon name="create-outline" color={theme.colors.socialText} size={21} /></View>
              <View style={styles.optionCopy}><AppText variant="bodyStrong">Edit post</AppText><AppText variant="caption" color={theme.colors.textMuted}>Change the text in this post</AppText></View>
              <AppIcon name="chevron-forward" color={theme.colors.textMuted} size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Delete post" onPress={deleteFromOptions} style={({ pressed }) => [styles.optionRow, { borderColor: theme.colors.border }, pressed && styles.pressed]}>
              <View style={[styles.optionIcon, { backgroundColor: theme.colors.surface }]}><AppIcon name="trash-outline" color={theme.colors.danger} size={21} /></View>
              <View style={styles.optionCopy}><AppText variant="bodyStrong" color={theme.colors.danger}>Delete post</AppText><AppText variant="caption" color={theme.colors.textMuted}>Remove it from member feeds</AppText></View>
              <AppIcon name="chevron-forward" color={theme.colors.danger} size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel post options" onPress={() => setOwnerMenuOpen(false)} style={({ pressed }) => [styles.optionCancel, { borderColor: theme.colors.border }, pressed && styles.pressed]}><AppText variant="bodyStrong">Cancel</AppText></Pressable>
          </View>
        </View>
      </Modal>
      <CommentsSheet visible={commentsOpen} postId={post._id as PostId} signedIn={signedIn} onClose={() => setCommentsOpen(false)} onReported={() => onAction('report_comment')} />
      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}><View style={[styles.sheet, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}><View style={styles.sheetHeader}><AppText variant="heading">Edit post</AppText><Pressable accessibilityRole="button" accessibilityLabel="Close editor" onPress={() => setEditing(false)} style={styles.close}><AppText variant="heading">×</AppText></Pressable></View><TextInput accessibilityLabel="Post text" value={editBody} onChangeText={setEditBody} multiline maxLength={1_001} style={[styles.editor, theme.typography.body, { color: theme.colors.text, borderColor: editBody.length > 1_000 ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]} /><AppText variant="caption" color={editBody.length > 1_000 ? theme.colors.danger : theme.colors.textMuted}>{editBody.length}/1,000</AppText><ActionButton label={busy ? 'Saving' : 'Save changes'} onPress={() => void saveEdit()} intent="social" disabled={busy || editBody.length > 1_000} /><ActionButton label="Cancel" onPress={() => setEditing(false)} intent="social" secondary disabled={busy} /></View></View>
      </Modal>
    </View>
  )
}

function CommentsSheet({ visible, postId, signedIn, onClose, onReported }: { visible: boolean; postId: PostId; signedIn: boolean; onClose: () => void; onReported: () => void }) {
  const theme = useAppTheme()
  const { results: comments, status, loadMore } = usePaginatedQuery(mobileApi.social.commentPage, visible ? { postId } : 'skip', { initialNumItems: 12 })
  const createComment = useMutation(mobileApi.social.createComment)
  const [body, setBody] = useState('')
  const [mentionCaret, setMentionCaret] = useState(0)
  const mentionToken = activeMentionQuery(body, mentionCaret)
  const mentionSuggestions = useQuery(mobileApi.social.mentionLookup, visible && mentionToken ? { query: mentionToken } : 'skip')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function insertMention(username: string) {
    const before = body.slice(0, mentionCaret).replace(/@[a-z0-9_]*$/i, `@${username} `)
    const next = before + body.slice(mentionCaret)
    setBody(next)
    setMentionCaret(before.length)
  }

  async function submit() {
    const trimmed = body.trim()
    if (!signedIn || !trimmed || trimmed.length > 500 || busy) return
    setBusy(true)
    setError('')
    try {
      await createComment({ postId, body: trimmed })
      setBody('')
    } catch {
      setError('Your comment could not be posted.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
          <View style={styles.sheetHeader}>
            <AppText variant="heading">Comments</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Close comments" onPress={onClose} style={styles.close}><AppText variant="heading">×</AppText></Pressable>
          </View>
          <FlatList style={styles.commentScroll} contentContainerStyle={styles.commentList} keyboardShouldPersistTaps="handled" data={comments} keyExtractor={(comment) => String(comment._id)} onEndReached={() => { if (status === 'CanLoadMore') loadMore(12) }} onEndReachedThreshold={0.4} ListEmptyComponent={status === 'LoadingFirstPage' ? (
              <AppText color={theme.colors.textMuted}>Loading comments.</AppText>
            ) : <AppText color={theme.colors.textMuted}>No comments yet.</AppText>} renderItem={({ item: comment }) => (
              <View style={[styles.comment, { borderBottomColor: theme.colors.border }]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`View ${comment.authorDisplayName}'s profile`} onPress={() => openMemberProfile(String(comment.authorId))} style={({ pressed }) => pressed && styles.pressed}><AppText variant="bodyStrong">{comment.authorDisplayName}</AppText></Pressable>
                <MentionBody body={comment.body} mentions={comment.mentions} />
                <View style={styles.authorRow}>
                  <AppText variant="caption" color={theme.colors.textMuted}>{formatMessageTimestamp(comment.createdAt)}</AppText>
                  {signedIn && !comment.ownComment ? <ReportAction targetType="comment" targetId={String(comment._id)} label="Report comment" compact onReported={onReported} /> : null}
                </View>
              </View>
            )} ListFooterComponent={status === 'LoadingMore' ? <AppText variant="caption" color={theme.colors.textMuted}>Loading more comments.</AppText> : null} />
          {signedIn ? (
            <>
              <TextInput
                accessibilityLabel="Write a comment"
                value={body}
                onChangeText={(value) => { setBody(value); setError(''); setMentionCaret(value.length) }}
                onSelectionChange={(event) => setMentionCaret(event.nativeEvent.selection.start)}
                placeholder="Write a respectful comment"
                placeholderTextColor={theme.colors.textMuted}
                multiline
                maxLength={501}
                style={[styles.commentInput, theme.typography.body, { color: theme.colors.text, borderColor: body.length > 500 ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}
              />
              {mentionToken && mentionSuggestions && mentionSuggestions.length > 0 ? (
                <View style={[styles.mentionMenu, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
                  {mentionSuggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion.userId}
                      accessibilityRole="button"
                      accessibilityLabel={`Mention ${suggestion.displayName} as ${suggestion.username}`}
                      onPress={() => insertMention(suggestion.username)}
                      style={({ pressed }) => [styles.mentionOption, pressed && styles.pressed]}
                    >
                      <Avatar name={suggestion.displayName} size={28} />
                      <View style={styles.mentionOptionCopy}>
                        <AppText variant="bodyStrong" numberOfLines={1}>{suggestion.displayName}</AppText>
                        <AppText variant="caption" color={theme.colors.socialText}>@{suggestion.username}</AppText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <AppText variant="caption" color={body.length > 500 ? theme.colors.danger : theme.colors.textMuted}>{body.length}/500</AppText>
              {error ? <AppText accessibilityRole="alert" color={theme.colors.danger}>{error}</AppText> : null}
              <ActionButton label={busy ? 'Posting comment' : 'Post comment'} onPress={() => void submit()} disabled={busy || !body.trim() || body.length > 500} />
            </>
          ) : <AppText variant="caption" color={theme.colors.textMuted}>Comments are public to read. Sign in to post or report a comment.</AppText>}
        </View>
      </View>
    </Modal>
  )
}

function PostAction({ label, icon, active = false, disabled = false, onPress }: { label: string; icon: AppIconName; active?: boolean; disabled?: boolean; onPress: () => void }) {
  const theme = useAppTheme()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected: active }} disabled={disabled} onPress={onPress} hitSlop={4} style={({ pressed }) => [styles.postAction, pressed && styles.pressed]}><AppIcon name={icon} color={active ? theme.colors.socialText : disabled ? theme.colors.textMuted : theme.colors.text} size={21} /></Pressable>
}

function openMemberProfile(userId: string, companionProfileId?: string) {
  router.push((companionProfileId
    ? { pathname: '/companion-profile/[id]', params: { id: companionProfileId } }
    : { pathname: '/member-profile/[id]', params: { id: userId } }) as never)
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  postCard: { paddingVertical: 8, gap: 6 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  identityCopy: { flex: 1, gap: 1 },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  authorLink: { flexShrink: 1 },
  optionsButton: { width: 36, height: 36, marginRight: -6, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  smallAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 3 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10 },
  videoLink: { minHeight: 60, borderWidth: 1, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  counts: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row' },
  postAction: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.68 },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  backdropDismiss: { position: 'absolute', inset: 0 },
  optionSheet: { borderWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, gap: 10 },
  optionHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  optionHeader: { gap: 2, paddingBottom: 4 },
  optionRow: { minHeight: 64, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, gap: 1 },
  optionCancel: { minHeight: 48, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  sheet: { borderWidth: 1, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28, gap: 10, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  editor: { minHeight: 150, borderWidth: 1, borderRadius: 12, padding: 13, textAlignVertical: 'top' },
  commentScroll: { flexShrink: 1 },
  commentList: { gap: 4, paddingBottom: 4 },
  comment: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8, gap: 3 },
  commentInput: { minHeight: 80, maxHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  mentionMenu: { borderWidth: 1, borderRadius: 12, padding: 6, gap: 2, maxHeight: 200 },
  mentionOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8 },
  mentionOptionCopy: { flex: 1, gap: 1 },
})
