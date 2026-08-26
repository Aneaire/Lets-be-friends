import { activeMentionQuery } from '@lets-be-friends/shared'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native'

import { mobileApi, type PostId } from '@/backend/client'
import { formatMessageTimestamp } from '@/data/messageViewModels'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Avatar } from '@/design-system/atoms/Avatar'
import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen } from '@/design-system/templates/Screen'
import { CommentBubble } from '@/features/social/CommentBubble'
import { MentionBody } from '@/features/social/MentionBody'
import { ReportAction } from '@/features/safety/ReportAction'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function PostCommentsScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const postId = typeof params.id === 'string' ? params.id : ''

  if (!postId) {
    return <CommentsState title="Comments are unavailable" action="Return home" onPress={() => router.replace('/')} />
  }

  return <ReadyPostComments postId={postId as PostId} />
}

function ReadyPostComments({ postId }: { postId: PostId }) {
  const theme = useAppTheme()
  const { results: comments, status, loadMore } = usePaginatedQuery(mobileApi.social.commentPage, { postId }, { initialNumItems: 20 })
  const createComment = useMutation(mobileApi.social.createComment)
  const [body, setBody] = useState('')
  const [mentionCaret, setMentionCaret] = useState(0)
  const mentionToken = activeMentionQuery(body, mentionCaret)
  const mentionSuggestions = useQuery(mobileApi.social.mentionLookup, mentionToken ? { query: mentionToken } : 'skip')
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
    if (!trimmed || trimmed.length > 500 || busy) return
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

  const composer = (
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
      <View style={styles.composerAction}>
        <AppText variant="caption" color={body.length > 500 ? theme.colors.danger : theme.colors.textMuted}>{body.length}/500</AppText>
        <ActionButton label={busy ? 'Posting comment' : 'Post comment'} onPress={() => void submit()} disabled={busy || !body.trim() || body.length > 500} intent="social" />
      </View>
      {error ? <AppText accessibilityRole="alert" color={theme.colors.danger}>{error}</AppText> : null}
    </View>
  )

  return (
    <Screen scroll={false} contentStyle={styles.screen} footer={composer}>
      <View style={styles.header}>
        <IconButton label="Back to home" icon="arrow-back" onPress={() => router.back()} />
        <View style={styles.headerCopy}>
          <AppText variant="heading">Comments</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>Join the post conversation respectfully.</AppText>
        </View>
      </View>
      <FlatList
        style={styles.commentScroll}
        contentContainerStyle={styles.commentList}
        keyboardShouldPersistTaps="handled"
        data={comments}
        keyExtractor={(comment) => String(comment._id)}
        onEndReached={() => { if (status === 'CanLoadMore') loadMore(20) }}
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
                onPress={() => router.push({ pathname: '/member-profile/[id]', params: { id: String(comment.authorId) } })}
                style={({ pressed }) => [styles.commentAuthor, pressed && styles.pressed]}
              >
                <AppText variant="bodyStrong" numberOfLines={1}>{comment.authorDisplayName}</AppText>
              </Pressable>
            )}
            action={!comment.ownComment ? <ReportAction targetType="comment" targetId={String(comment._id)} label="Report comment" compact /> : undefined}
          >
            <MentionBody body={comment.body} mentions={comment.mentions} />
          </CommentBubble>
        )}
        ListFooterComponent={status === 'LoadingMore' ? <AppText variant="caption" color={theme.colors.textMuted}>Loading more comments.</AppText> : null}
      />
    </Screen>
  )
}

function CommentsState({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return <Screen contentStyle={styles.state}><StateView title={title} actionLabel={action} onAction={onPress} intent="social" /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <CommentsState title="Comments could not be loaded" action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  state: { flexGrow: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12 },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  commentScroll: { flex: 1 },
  commentList: { gap: 10, paddingBottom: 20 },
  commentAuthor: { maxWidth: '45%', flexShrink: 1 },
  commentComposer: { gap: 8 },
  commentInput: { minHeight: 64, maxHeight: 112, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  mentionMenu: { borderWidth: 1, borderRadius: 12, padding: 6, gap: 2, maxHeight: 160 },
  mentionOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8 },
  mentionOptionCopy: { flex: 1, gap: 1 },
  composerAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pressed: { opacity: 0.68 },
})
