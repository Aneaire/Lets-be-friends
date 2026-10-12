import { arrangeCommentThreads, withoutLeadingReplyMention, type CommentThreadPosition } from '@lets-be-friends/shared'
import { useMutation, useQuery } from 'convex/react'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi, type CommentId, type PostId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { Avatar } from '@/design-system/atoms/Avatar'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { CommentBubble } from '@/features/social/CommentBubble'
import { MentionBody } from '@/features/social/MentionBody'
import { openMemberProfile } from '@/features/social/socialNavigation'
import { useAppTheme } from '@/theme/ThemeProvider'

import { circleActionError } from './circlePresentation'

type CircleComment = {
  _id: string
  body: string
  authorId: string
  authorDisplayName: string
  authorUsername?: string | null
  authorProfileImageUrl?: string | null
  createdAt: number
  ownComment: boolean
  liked: boolean
  likeCount: number
  parentCommentId?: string | null
  replyToAuthorId?: string | null
  replyToAuthorUsername?: string | null
  replyToAuthorDisplayName?: string | null
  mentions?: Array<{ userId: string; username: string; displayName: string }>
}

/**
 * Threaded Circle comments with reply context, like counts, and author
 * profile navigation. Moderators remove, other members report.
 */
export function CircleComments({ postId, canWrite, canModerate, focusCommentId }: {
  postId: PostId
  canWrite: boolean
  canModerate: boolean
  focusCommentId?: string
}) {
  const theme = useAppTheme()
  const comments = useQuery(mobileApi.social.commentsForPost, { postId })
  const create = useMutation(mobileApi.social.createComment)
  const toggleLike = useMutation(mobileApi.social.toggleCommentLike)
  const remove = useMutation(mobileApi.circles.setCommentRemoved)
  const report = useMutation(mobileApi.reports.create)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const threaded = useMemo(() => arrangeCommentThreads((comments ?? []) as CircleComment[]), [comments])

  async function submit() {
    const trimmed = body.trim()
    if (!trimmed || trimmed.length > 500 || busy || !canWrite) return
    setBusy(true)
    setError('')
    try {
      await create({ postId, body: trimmed })
      setBody('')
    } catch (cause) {
      setError(circleActionError(cause, 'The comment could not be posted.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.thread, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      {comments === undefined ? (
        <AppText>Loading comments...</AppText>
      ) : threaded.length === 0 ? (
        <AppText color={theme.colors.textMuted}>No comments yet.</AppText>
      ) : (
        threaded.map(({ comment, position, isLastReply }) => (
          <CircleCommentRow
            key={String(comment._id)}
            comment={comment}
            threadPosition={position}
            isLastReply={isLastReply}
            focused={focusCommentId !== undefined && String(comment._id) === focusCommentId}
            canWrite={canWrite}
            canModerate={canModerate}
            onReply={(replyBody) => create({ postId, parentCommentId: comment._id as CommentId, body: replyBody })}
            onLike={() => toggleLike({ commentId: comment._id as CommentId })}
            onRemove={() => remove({ commentId: comment._id as CommentId, removed: true })}
            onReport={() => report({ targetType: 'comment', targetId: String(comment._id), reason: 'Circle comment needs safety review' })}
          />
        ))
      )}
      {canWrite ? (
        <View style={styles.composer}>
          <TextField style={styles.flex} value={body} maxLength={500} placeholder="Write a comment" onChangeText={(value) => { setBody(value); setError('') }} />
          <ActionButton compact label={busy ? 'Posting' : 'Comment'} intent="social" loading={busy} disabled={!body.trim() || body.length > 500} onPress={() => void submit()} />
        </View>
      ) : null}
      {error ? (
        <InlineNotice title="Comment failed" tone="danger">
          {error}
        </InlineNotice>
      ) : null}
    </View>
  )
}

function CircleCommentRow({ comment, threadPosition, isLastReply, focused, canWrite, canModerate, onReply, onLike, onRemove, onReport }: {
  comment: CircleComment
  threadPosition: CommentThreadPosition
  isLastReply: boolean
  focused: boolean
  canWrite: boolean
  canModerate: boolean
  onReply: (body: string) => Promise<unknown>
  onLike: () => Promise<unknown>
  onRemove: () => Promise<unknown>
  onReport: () => Promise<unknown>
}) {
  const theme = useAppTheme()
  const [replying, setReplying] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [pending, setPending] = useState<'like' | 'reply' | 'moderate' | ''>('')
  const [error, setError] = useState('')
  const date = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(comment.createdAt)
  const openProfile = () => openMemberProfile(String(comment.authorId))
  const profileLabel = `View ${comment.authorDisplayName}'s profile`

  async function submitReply() {
    const trimmed = replyBody.trim()
    if (!trimmed || trimmed.length > 500 || pending || !canWrite) return
    setPending('reply')
    setError('')
    try {
      await onReply(trimmed)
      setReplyBody('')
      setReplying(false)
    } catch (cause) {
      setError(circleActionError(cause, 'Your reply could not be posted.'))
    } finally {
      setPending('')
    }
  }

  async function toggleCommentLike() {
    if (pending || !canWrite) return
    setPending('like')
    setError('')
    try {
      await onLike()
    } catch (cause) {
      setError(circleActionError(cause, 'The like could not be updated.'))
    } finally {
      setPending('')
    }
  }

  async function moderate(removeComment: boolean) {
    if (pending) return
    // Destructive removal needs an explicit in-view confirmation on every
    // device, so a single mistaken tap never hides a comment.
    if (removeComment && !confirmingRemove) {
      setError('')
      setConfirmingRemove(true)
      return
    }
    setPending('moderate')
    setError('')
    try {
      if (removeComment) await onRemove()
      else await onReport()
      setConfirmingRemove(false)
    } catch (cause) {
      setError(circleActionError(cause, removeComment ? 'The comment could not be removed.' : 'The report could not be sent.'))
    } finally {
      setPending('')
    }
  }

  return (
    <View style={focused ? [styles.focused, { borderColor: theme.colors.socialText }] : undefined}>
      <CommentBubble
        author={comment.authorDisplayName}
        imageUrl={comment.authorProfileImageUrl}
        timestamp={date}
        threadPosition={threadPosition}
        isLastReply={isLastReply}
        replyContext={comment.parentCommentId && comment.replyToAuthorId ? (
          <AppText variant="caption" color={theme.colors.textMuted}>
            Replying to{' '}
            <AppText
              accessibilityRole="link"
              onPress={() => openMemberProfile(String(comment.replyToAuthorId))}
              variant="caption"
              color={theme.colors.socialText}
            >
              {comment.replyToAuthorUsername ? `@${comment.replyToAuthorUsername}` : comment.replyToAuthorDisplayName ?? 'Member'}
            </AppText>
          </AppText>
        ) : undefined}
        avatarAction={(
          <Pressable accessibilityRole="button" accessibilityLabel={profileLabel} onPress={openProfile} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
            <Avatar uri={comment.authorProfileImageUrl ?? undefined} name={comment.authorDisplayName} size={36} />
          </Pressable>
        )}
        authorAction={(
          <Pressable accessibilityRole="button" accessibilityLabel={profileLabel} onPress={openProfile} hitSlop={8} style={({ pressed }) => [styles.author, pressed && styles.pressed]}>
            <AppText variant="bodyStrong" numberOfLines={1}>{comment.authorDisplayName}</AppText>
          </Pressable>
        )}
        action={canModerate ? (
          confirmingRemove ? (
            <View style={styles.confirmRow}>
              <AppText variant="caption" color={theme.colors.textMuted}>Remove this comment? Members will no longer see it.</AppText>
              <View style={styles.confirmActions}>
                <ActionButton compact label={pending === 'moderate' ? 'Removing' : 'Confirm remove'} intent="danger" loading={pending === 'moderate'} onPress={() => void moderate(true)} />
                <ActionButton compact label="Cancel" intent="neutral" secondary disabled={pending === 'moderate'} onPress={() => setConfirmingRemove(false)} />
              </View>
            </View>
          ) : (
            <ActionButton compact label={`Remove ${comment.authorDisplayName}'s comment`} intent="danger" secondary loading={pending === 'moderate'} onPress={() => void moderate(true)} />
          )
        ) : !comment.ownComment ? (
          <ActionButton compact label="Report comment" intent="danger" secondary loading={pending === 'moderate'} onPress={() => void moderate(false)} />
        ) : undefined}
      >
        <MentionBody body={withoutLeadingReplyMention(comment.body, comment.replyToAuthorUsername)} mentions={comment.mentions} />
        {focused ? <AppText variant="caption" color={theme.colors.socialText}>Focused from notification</AppText> : null}
        <View style={styles.interactions} accessibilityLabel={`Interactions for ${comment.authorDisplayName}'s comment`}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${comment.authorDisplayName}`}
            accessibilityState={{ disabled: !canWrite || Boolean(pending), expanded: replying }}
            disabled={!canWrite || Boolean(pending)}
            onPress={() => { setReplyBody(''); setError(''); setReplying(true) }}
            hitSlop={8}
            style={({ pressed }) => [styles.interaction, pressed && styles.pressed]}
          >
            <AppIcon name="chatbubble-outline" size={14} color={theme.colors.textMuted} />
            <AppText variant="caption" color={theme.colors.textMuted}>Reply</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${comment.liked ? 'Unlike' : 'Like'} ${comment.authorDisplayName}'s comment`}
            accessibilityState={{ disabled: !canWrite || Boolean(pending), selected: comment.liked }}
            disabled={!canWrite || Boolean(pending)}
            onPress={() => void toggleCommentLike()}
            hitSlop={8}
            style={({ pressed }) => [styles.interaction, pressed && styles.pressed]}
          >
            <AppIcon name={comment.liked ? 'heart' : 'heart-outline'} size={14} color={comment.liked ? theme.colors.socialText : theme.colors.textMuted} />
            <AppText variant="caption" color={comment.liked ? theme.colors.socialText : theme.colors.textMuted}>
              {comment.likeCount > 0 ? String(comment.likeCount) : 'Like'}
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={profileLabel}
            onPress={() => router.push({ pathname: '/member-profile/[id]', params: { id: String(comment.authorId) } })}
            hitSlop={8}
            style={({ pressed }) => [styles.interaction, pressed && styles.pressed]}
          >
            <AppText variant="caption" color={theme.colors.socialText}>Profile</AppText>
          </Pressable>
        </View>
        {replying && canWrite ? (
          <View style={styles.replyComposer}>
            <TextField accessibilityLabel={`Reply to ${comment.authorDisplayName}`} value={replyBody} maxLength={500} multiline placeholder="Write a reply" onChangeText={(value) => { setReplyBody(value); setError('') }} />
            <View style={styles.replyActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" disabled={pending === 'reply'} onPress={() => setReplying(false)} hitSlop={8}>
                <AppText variant="caption" color={theme.colors.textMuted}>Cancel</AppText>
              </Pressable>
              <ActionButton label={pending === 'reply' ? 'Replying' : 'Reply'} onPress={() => void submitReply()} disabled={pending === 'reply' || !replyBody.trim() || replyBody.length > 500} loading={pending === 'reply'} intent="social" compact />
            </View>
          </View>
        ) : null}
        {error ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{error}</AppText> : null}
      </CommentBubble>
    </View>
  )
}

const styles = StyleSheet.create({
  thread: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 10 },
  focused: { borderWidth: 1, borderRadius: 10, padding: 4 },
  composer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  author: { maxWidth: '45%', flexShrink: 1 },
  interactions: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  interaction: { minWidth: 32, minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, justifyContent: 'center' },
  replyComposer: { gap: 6, paddingTop: 2, paddingBottom: 4 },
  replyActions: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14 },
  confirmRow: { gap: 6, maxWidth: 280 },
  confirmActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pressed: { opacity: 0.68 },
})
