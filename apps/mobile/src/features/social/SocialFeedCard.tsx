import type { FunctionReturnType } from 'convex/server'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { useState } from 'react'
import { Alert, FlatList, Image, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { api as generatedApi } from '../../../../web/convex/_generated/api'
import { activeMentionQuery, splitBodyIntoSegments, type StoredMention } from '@lets-be-friends/shared'

import { mobileApi, type PostId } from '@/backend/client'
import { formatMessageTimestamp } from '@/data/messageViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppIcon, type AppIconName } from '@/design-system/atoms/AppIcon'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { Avatar } from '@/design-system/atoms/Avatar'
import { ReportAction } from '@/features/safety/ReportAction'
import { AppText } from '@/design-system/atoms/Typography'

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
  return <View style={[styles.card, styles.guidanceCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}><AppText variant="caption" color={theme.colors.socialText}>{item.reason}</AppText><AppText variant="bodyStrong">{item.title}</AppText><AppText color={theme.colors.textMuted}>{item.body}</AppText><ActionButton label={item.actionLabel} onPress={() => { onAction('open_guidance'); router.push('/explore') }} secondary style={styles.guidanceAction} /></View>
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
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
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
    setOptionsOpen(true)
  }

  function editFromOptions() {
    setOptionsOpen(false)
    setEditing(true)
  }

  function deleteFromOptions() {
    setOptionsOpen(false)
    setTimeout(confirmDelete, 220)
  }

  function reportFromOptions() {
    setOptionsOpen(false)
    setTimeout(() => setReportOpen(true), 220)
  }

  return (
    <View style={[styles.postCard, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
      <View style={styles.postHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${post.authorDisplayName}'s profile`}
          onPress={() => openMemberProfile(String(post.authorId), post.authorCompanionProfileId ? String(post.authorCompanionProfileId) : undefined)}
          hitSlop={3}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Avatar uri={post.authorProfileImageUrl} name={post.authorDisplayName} size={40} />
        </Pressable>
        <View style={styles.postIdentityLine}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${post.authorDisplayName}'s profile`}
              onPress={() => openMemberProfile(String(post.authorId), post.authorCompanionProfileId ? String(post.authorCompanionProfileId) : undefined)}
              style={({ pressed }) => [styles.authorLink, pressed && styles.pressed]}
            >
              <AppText variant="bodyStrong" numberOfLines={1}>{post.authorDisplayName}</AppText>
            </Pressable>
            <AppText variant="caption" color={theme.colors.textMuted}>·</AppText>
            <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{formatMessageTimestamp(post.createdAt)}</AppText>
            {signedIn && !post.ownPost ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={following ? `Unfollow ${post.authorDisplayName}` : `Follow ${post.authorDisplayName}`}
                accessibilityState={{ disabled: followBusy }}
                disabled={followBusy}
                onPress={() => void follow()}
                style={styles.smallAction}
              >
                <AppText variant="caption" color={followBusy ? theme.colors.textMuted : theme.colors.socialText}>{following ? 'Following' : 'Follow'}</AppText>
              </Pressable>
            ) : null}
        </View>
        {signedIn ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post options"
            onPress={openPostOptions}
            style={({ pressed }) => [styles.optionsButton, pressed && styles.pressed]}
          >
            <AppIcon name="ellipsis-horizontal" color={theme.colors.textMuted} size={20} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.postBody}>
        {post.body ? <MentionBody body={post.body} mentions={post.mentions} /> : null}
      {post.media.filter((media: PostMedia) => media.kind === 'image' && media.url).map((media: PostMedia, index: number) => <Image key={`${media.storageId}-${index}`} source={{ uri: media.url as string }} resizeMode="cover" style={styles.image} accessibilityLabel="Post image" />)}
      {post.media.filter((media: PostMedia) => media.kind === 'video' && media.url).map((media: PostMedia, index: number) => <Pressable key={`${media.storageId}-video-${index}`} accessibilityRole="link" accessibilityLabel="Open post video" onPress={() => void openVideo(media.url as string)} style={[styles.videoLink, { borderColor: theme.colors.border }]}><AppText variant="bodyStrong" color={theme.colors.socialText}>Open post video</AppText><AppText variant="caption" color={theme.colors.textMuted}>Opens through your device's supported video app</AppText></Pressable>)}
        <View style={styles.actions}>
          <PostAction label={liked ? 'Unlike post' : 'Like post'} icon={liked ? 'heart' : 'heart-outline'} count={likeCount} active={liked} disabled={!signedIn || busy} onPress={() => void like()} />
          <PostAction label="Comment on post" icon="chatbubble-outline" count={post.commentCount} onPress={() => { setCommentsOpen(true); onAction('comment') }} />
          <PostAction label={saved ? 'Remove post from saved' : 'Save post'} icon={saved ? 'bookmark' : 'bookmark-outline'} active={saved} disabled={!signedIn || busy} onPress={() => void save()} />
        </View>
      {!post.ownPost && signedIn ? <ReportAction targetType="post" targetId={String(post._id)} label="Report post" open={reportOpen} onOpenChange={setReportOpen} showTrigger={false} onReported={() => onAction('report')} /> : null}
      <Modal visible={optionsOpen} transparent animationType="fade" onRequestClose={() => setOptionsOpen(false)}>
        <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}> 
          <Pressable accessibilityRole="button" accessibilityLabel="Close post options" onPress={() => setOptionsOpen(false)} style={styles.backdropDismiss} />
          <View style={[styles.optionSheet, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}> 
            <View style={[styles.optionHandle, { backgroundColor: theme.colors.borderStrong }]} />
            <View style={styles.optionHeader}><AppText variant="bodyStrong">{post.ownPost ? 'Your post' : 'Post options'}</AppText></View>
            {post.ownPost ? <><Pressable accessibilityRole="button" accessibilityLabel="Edit post" onPress={editFromOptions} style={({ pressed }) => [styles.optionRow, { borderColor: theme.colors.border }, pressed && styles.pressed]}>
              <View style={styles.optionIcon}><AppIcon name="create-outline" color={theme.colors.textMuted} size={21} /></View>
              <View style={styles.optionCopy}><AppText variant="bodyStrong">Edit post</AppText></View>
              <AppIcon name="chevron-forward" color={theme.colors.textMuted} size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Delete post" onPress={deleteFromOptions} style={({ pressed }) => [styles.optionRow, { borderColor: theme.colors.border }, pressed && styles.pressed]}>
              <View style={styles.optionIcon}><AppIcon name="trash-outline" color={theme.colors.danger} size={21} /></View>
              <View style={styles.optionCopy}><AppText variant="bodyStrong" color={theme.colors.danger}>Delete post</AppText></View>
              <AppIcon name="chevron-forward" color={theme.colors.danger} size={19} />
            </Pressable></> : <Pressable accessibilityRole="button" accessibilityLabel="Report post" onPress={reportFromOptions} style={({ pressed }) => [styles.optionRow, { borderColor: theme.colors.border }, pressed && styles.pressed]}>
              <View style={styles.optionIcon}><AppIcon name="flag-outline" color={theme.colors.danger} size={21} /></View>
              <View style={styles.optionCopy}><AppText variant="bodyStrong" color={theme.colors.danger}>Report post</AppText></View>
              <AppIcon name="chevron-forward" color={theme.colors.danger} size={19} />
            </Pressable>}
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel post options" onPress={() => setOptionsOpen(false)} style={({ pressed }) => [styles.optionCancel, { borderColor: theme.colors.border }, pressed && styles.pressed]}><AppText variant="bodyStrong">Cancel</AppText></Pressable>
          </View>
        </View>
      </Modal>
      <CommentsSheet visible={commentsOpen} postId={post._id as PostId} signedIn={signedIn} onClose={() => setCommentsOpen(false)} onReported={() => onAction('report_comment')} />
      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}><View style={[styles.sheet, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}><View style={styles.sheetHeader}><AppText variant="heading">Edit post</AppText><Pressable accessibilityRole="button" accessibilityLabel="Close editor" onPress={() => setEditing(false)} style={styles.close}><AppText variant="heading">×</AppText></Pressable></View><TextInput accessibilityLabel="Post text" value={editBody} onChangeText={setEditBody} multiline maxLength={1_001} style={[styles.editor, theme.typography.body, { color: theme.colors.text, borderColor: editBody.length > 1_000 ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]} /><AppText variant="caption" color={editBody.length > 1_000 ? theme.colors.danger : theme.colors.textMuted}>{editBody.length}/1,000</AppText><ActionButton label={busy ? 'Saving' : 'Save changes'} onPress={() => void saveEdit()} intent="social" disabled={busy || editBody.length > 1_000} /><ActionButton label="Cancel" onPress={() => setEditing(false)} intent="social" secondary disabled={busy} /></View></View>
      </Modal>
      </View>
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
                <Avatar name={comment.authorDisplayName} size={32} />
                <View style={styles.commentCopy}>
                  <View style={styles.commentHeader}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View ${comment.authorDisplayName}'s profile`}
                      onPress={() => openMemberProfile(String(comment.authorId))}
                      style={({ pressed }) => [styles.commentAuthor, pressed && styles.pressed]}
                    >
                      <AppText variant="bodyStrong" numberOfLines={1}>{comment.authorDisplayName}</AppText>
                    </Pressable>
                    <AppText variant="caption" color={theme.colors.textMuted}>·</AppText>
                    <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{formatMessageTimestamp(comment.createdAt)}</AppText>
                    {signedIn && !comment.ownComment ? (
                      <View style={styles.commentReport}>
                        <ReportAction targetType="comment" targetId={String(comment._id)} label="Report comment" compact onReported={onReported} />
                      </View>
                    ) : null}
                  </View>
                  <MentionBody body={comment.body} mentions={comment.mentions} />
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

function PostAction({
  label,
  icon,
  count = 0,
  active = false,
  disabled = false,
  onPress,
}: {
  label: string
  icon: AppIconName
  count?: number
  active?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const theme = useAppTheme()
  const color = disabled ? theme.colors.textMuted : theme.colors.text

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.postAction, pressed && styles.pressed]}
    >
      <AppIcon name={icon} color={color} size={20} />
      {count > 0 ? <AppText variant="caption" color={color}>{count}</AppText> : null}
    </Pressable>
  )
}

function openMemberProfile(userId: string, companionProfileId?: string) {
  router.push((companionProfileId
    ? { pathname: '/companion-profile/[id]', params: { id: companionProfileId } }
    : { pathname: '/member-profile/[id]', params: { id: userId } }) as never)
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 7 },
  guidanceCard: { gap: 6 },
  guidanceAction: { minHeight: 44, marginTop: 2 },
  postCard: {
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  postBody: { minWidth: 0, gap: 4 },
  postHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  postIdentityLine: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identityCopy: { flex: 1, gap: 1 },
  authorLink: { maxWidth: '48%', flexShrink: 1 },
  optionsButton: { width: 44, height: 44, marginRight: -8, marginVertical: -10, alignItems: 'center', justifyContent: 'center' },
  smallAction: { minHeight: 44, justifyContent: 'center', marginVertical: -11, paddingHorizontal: 3 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8 },
  videoLink: { minHeight: 60, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  actions: { maxWidth: 280, flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  postAction: { minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginVertical: -4, paddingHorizontal: 8 },
  pressed: { opacity: 0.68 },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  backdropDismiss: { position: 'absolute', inset: 0 },
  optionSheet: { borderWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 18, gap: 7 },
  optionHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  optionHeader: { paddingBottom: 2 },
  optionRow: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, gap: 1 },
  optionCancel: { minHeight: 44, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  sheet: { borderWidth: 1, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14, paddingBottom: 28, gap: 10, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  editor: { minHeight: 150, borderWidth: 1, borderRadius: 12, padding: 13, textAlignVertical: 'top' },
  commentScroll: { flexShrink: 1 },
  commentList: { paddingBottom: 4 },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  commentCopy: { flex: 1, minWidth: 0, gap: 2 },
  commentHeader: { minHeight: 22, flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  commentAuthor: { maxWidth: '45%', flexShrink: 1 },
  commentReport: { marginLeft: 'auto', marginVertical: -11 },
  commentInput: { minHeight: 80, maxHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  mentionMenu: { borderWidth: 1, borderRadius: 12, padding: 6, gap: 2, maxHeight: 200 },
  mentionOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8 },
  mentionOptionCopy: { flex: 1, gap: 1 },
})
