import type { FunctionReturnType } from 'convex/server'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { api as generatedApi } from '../../../../web/convex/_generated/api'
import { activeMentionQuery, splitBodyIntoSegments, type StoredMention } from '@lets-be-friends/shared'

import { mobileApi, type PostId } from '@/backend/client'
import { formatMessageTimestamp } from '@/data/messageViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Avatar } from '@/design-system/atoms/Avatar'
import { IconButton } from '@/design-system/atoms/IconButton'
import { ActionSheet, type ActionSheetItem } from '@/design-system/molecules/ActionSheet'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { BottomSheet } from '@/design-system/molecules/BottomSheet'
import { ReportAction } from '@/features/safety/ReportAction'
import { AppText } from '@/design-system/atoms/Typography'

import { CommentBubble } from './CommentBubble'
import { EditPostSheet } from './EditPostSheet'
import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { PostFollowAction } from './PostFollowAction'
import { PostMediaGrid } from './PostMediaGrid'

type FeedItem = FunctionReturnType<typeof generatedApi.social.feedPage>['page'][number]
type FeedAction = 'open_companion' | 'open_guidance' | 'comment' | 'like' | 'save' | 'follow' | 'report' | 'report_comment'

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
  return <ConnectedPostCard item={item} signedIn={signedIn} following={following ?? item.post.followingAuthor} followBusy={followBusy} onToggleFollow={onToggleFollow} onAction={onAction} />
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

function ConnectedPostCard({ item, signedIn, following, followBusy, onToggleFollow, onAction }: {
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
      await toggleLike({ postId: post._id as PostId })
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
      await toggleSave({ postId: post._id as PostId })
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

  const optionItems: ActionSheetItem[] = post.ownPost
    ? [
        { label: 'Edit post', icon: 'create-outline', tone: 'self', onPress: editFromOptions },
        { label: 'Delete post', icon: 'trash-outline', tone: 'danger', onPress: deleteFromOptions },
      ]
    : [
        { label: 'Report post', icon: 'flag-outline', tone: 'danger', onPress: reportFromOptions },
      ]

  const openAuthorProfile = () => openMemberProfile(
    String(post.authorId),
    post.authorCompanionProfileId ? String(post.authorCompanionProfileId) : undefined,
  )

  const profileLabel = `View ${post.authorDisplayName}'s profile`

  return (
    <PostCard
      author={post.authorDisplayName}
      imageUrl={post.authorProfileImageUrl}
      timestamp={formatMessageTimestamp(post.createdAt)}
      avatarAction={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={profileLabel}
          onPress={openAuthorProfile}
          hitSlop={3}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Avatar uri={post.authorProfileImageUrl} name={post.authorDisplayName} size={38} />
        </Pressable>
      )}
      authorAction={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={profileLabel}
          onPress={openAuthorProfile}
          style={({ pressed }) => [styles.authorLink, pressed && styles.pressed]}
        >
          <AppText variant="bodyStrong" numberOfLines={1}>{post.authorDisplayName}</AppText>
        </Pressable>
      )}
      meta={signedIn && !post.ownPost ? (
        <PostFollowAction
          author={post.authorDisplayName}
          following={following}
          busy={followBusy}
          onPress={() => void follow()}
        />
      ) : undefined}
      headerAction={signedIn ? (
        <IconButton
          label="Post options"
          icon="ellipsis-horizontal"
          onPress={openPostOptions}
        />
      ) : undefined}
      footer={(
        <PostActionBar
          liked={post.liked}
          likeCount={post.likeCount}
          saved={post.saved}
          commentCount={post.commentCount}
          disabled={!signedIn || busy}
          onLike={() => void like()}
          onComment={() => {
            setCommentsOpen(true)
            onAction('comment')
          }}
          onSave={() => void save()}
        />
      )}
    >
      <View style={styles.postBody}>
        {post.body ? <MentionBody body={post.body} mentions={post.mentions} /> : null}
        <PostMediaGrid media={post.media} onOpenVideo={(url) => void openVideo(url)} />
        {!post.ownPost && signedIn ? <ReportAction targetType="post" targetId={String(post._id)} label="Report post" open={reportOpen} onOpenChange={setReportOpen} showTrigger={false} onReported={() => onAction('report')} /> : null}
        <ActionSheet
          visible={optionsOpen}
          title={post.ownPost ? 'Your post' : 'Post options'}
          items={optionItems}
          onClose={() => setOptionsOpen(false)}
        />
        <CommentsSheet visible={commentsOpen} postId={post._id as PostId} signedIn={signedIn} onClose={() => setCommentsOpen(false)} onReported={() => onAction('report_comment')} />
        <EditPostSheet
          visible={editing}
          body={editBody}
          busy={busy}
          allowEmpty={post.media.length > 0}
          onBodyChange={setEditBody}
          onSave={() => void saveEdit()}
          onClose={() => setEditing(false)}
        />
      </View>
    </PostCard>
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
    <BottomSheet
      visible={visible}
      title="Comments"
      closeLabel="Close comments"
      scrollable={false}
      onClose={onClose}
      footer={signedIn ? (
        <View style={styles.commentComposer}>
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
        </View>
      ) : (
        <AppText variant="caption" color={theme.colors.textMuted}>Comments are public to read. Sign in to post or report a comment.</AppText>
      )}
    >
      <FlatList
        style={styles.commentScroll}
        contentContainerStyle={styles.commentList}
        keyboardShouldPersistTaps="handled"
        data={comments}
        keyExtractor={(comment) => String(comment._id)}
        onEndReached={() => { if (status === 'CanLoadMore') loadMore(12) }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={status === 'LoadingFirstPage' ? (
          <AppText color={theme.colors.textMuted}>Loading comments.</AppText>
        ) : <AppText color={theme.colors.textMuted}>No comments yet.</AppText>}
        renderItem={({ item: comment }) => (
          <CommentBubble
            author={comment.authorDisplayName}
            timestamp={formatMessageTimestamp(comment.createdAt)}
            authorAction={(
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${comment.authorDisplayName}'s profile`}
                onPress={() => openMemberProfile(String(comment.authorId))}
                style={({ pressed }) => [styles.commentAuthor, pressed && styles.pressed]}
              >
                <AppText variant="bodyStrong" numberOfLines={1}>{comment.authorDisplayName}</AppText>
              </Pressable>
            )}
            action={signedIn && !comment.ownComment ? (
              <ReportAction targetType="comment" targetId={String(comment._id)} label="Report comment" compact onReported={onReported} />
            ) : undefined}
          >
            <MentionBody body={comment.body} mentions={comment.mentions} />
          </CommentBubble>
        )}
        ListFooterComponent={status === 'LoadingMore' ? <AppText variant="caption" color={theme.colors.textMuted}>Loading more comments.</AppText> : null}
      />
    </BottomSheet>
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
  postBody: { minWidth: 0, gap: 4 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identityCopy: { flex: 1, gap: 1 },
  authorLink: { maxWidth: '48%', flexShrink: 1 },
  pressed: { opacity: 0.68 },
  commentScroll: { flexShrink: 1 },
  commentComposer: { gap: 8 },
  commentList: { paddingBottom: 4 },
  commentAuthor: { maxWidth: '45%', flexShrink: 1 },
  commentInput: { minHeight: 80, maxHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  mentionMenu: { borderWidth: 1, borderRadius: 12, padding: 6, gap: 2, maxHeight: 200 },
  mentionOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8 },
  mentionOptionCopy: { flex: 1, gap: 1 },
})
