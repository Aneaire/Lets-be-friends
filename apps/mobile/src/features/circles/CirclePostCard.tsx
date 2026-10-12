import type { FunctionReturnType } from 'convex/server'
import { useMutation } from 'convex/react'
import { BlurTargetView } from 'expo-blur'
import { useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'

import { mobileApi, type PostId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Avatar } from '@/design-system/atoms/Avatar'
import { AppText } from '@/design-system/atoms/Typography'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { PostActionBar } from '@/features/social/PostActionBar'
import { PostCard } from '@/features/social/PostCard'
import { PostContent } from '@/features/social/PostContent'
import { ModalPostImageViewer } from '@/features/media/ModalPostImageViewer'
import type { PostViewerImage } from '@/features/social/PostImageViewer'
import { NativeVideoViewer } from '@/features/media/NativeVideoViewer'
import { openMemberProfile } from '@/features/social/socialNavigation'
import { useAppTheme } from '@/theme/ThemeProvider'

import { CircleComments } from './CircleComments'
import { circleActionError, circlePostApprovalLabel } from './circlePresentation'

export type CirclePost = FunctionReturnType<typeof mobileApi.social.circleFeed>['page'][number]

/**
 * Circle discussion post with approval labels, media, polls, author links,
 * image viewing, and threaded comments.
 */
export function CirclePostCard({ post, canWrite, canModerate, pinned, expanded, focusCommentId, onTogglePin, onToggleComments }: {
  post: CirclePost
  canWrite: boolean
  canModerate: boolean
  pinned: boolean
  expanded: boolean
  focusCommentId?: string
  onTogglePin: () => void
  onToggleComments: () => void
}) {
  const theme = useAppTheme()
  const blurTarget = useRef<View>(null)
  const toggleLike = useMutation(mobileApi.social.toggleLike)
  const toggleSave = useMutation(mobileApi.social.toggleSavePost)
  const voteOnPoll = useMutation(mobileApi.social.voteOnPoll)
  const remove = useMutation(mobileApi.circles.setPostRemoved)
  const report = useMutation(mobileApi.reports.create)
  const [viewerImage, setViewerImage] = useState<PostViewerImage | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const date = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(post.createdAt)
  const approvalLabel = circlePostApprovalLabel(post.approvalState)
  const profileLabel = `View ${post.authorDisplayName}'s profile`
  const openProfile = () => openMemberProfile(String(post.authorId))

  function openVideo(url: string) {
    setError('')
    setVideoUrl(url)
  }

  const meta = (
    <>
      {post.circleKind === 'announcement' ? <AppText variant="caption" color={theme.colors.socialText}>Announcement</AppText> : null}
      {pinned ? <AppText variant="caption" color={theme.colors.socialText}>Pinned</AppText> : null}
      {approvalLabel ? (
        <AppText variant="caption" color={post.approvalState === 'rejected' ? theme.colors.danger : theme.colors.warning}>
          {approvalLabel}
        </AppText>
      ) : null}
    </>
  )

  return (
    <>
      <BlurTargetView ref={blurTarget} importantForAccessibility={viewerImage ? 'no-hide-descendants' : 'auto'}>
        <View>
          <PostCard
          author={post.authorDisplayName}
          username={post.authorUsername}
          imageUrl={post.authorProfileImageUrl}
          timestamp={date}
          meta={meta}
          avatarAction={(
            <Pressable accessibilityRole="button" accessibilityLabel={profileLabel} onPress={openProfile} hitSlop={3} style={({ pressed }) => pressed && styles.pressed}>
              <Avatar uri={post.authorProfileImageUrl ?? undefined} name={post.authorDisplayName} size={42} />
            </Pressable>
          )}
          authorAction={(
            <Pressable accessibilityRole="button" accessibilityLabel={profileLabel} onPress={openProfile} style={({ pressed }) => [styles.authorLink, pressed && styles.pressed]}>
              <AppText variant="bodyStrong" numberOfLines={1}>{post.authorDisplayName}</AppText>
            </Pressable>
          )}
          headerAction={canModerate ? (
            <View style={styles.row}>
              <ActionButton label={pinned ? 'Unpin post' : 'Pin post'} compact intent="neutral" secondary onPress={onTogglePin} />
              <ActionButton label="Moderate post" compact intent="danger" secondary onPress={() => Alert.alert('Remove this post?', 'Members will no longer see it. The moderation queue can restore it.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove post', style: 'destructive', onPress: () => void remove({ postId: post._id as PostId, removed: true }).catch((cause) => setError(circleActionError(cause, 'The post could not be removed.'))) },
              ])} />
            </View>
          ) : !post.ownPost ? (
            <ActionButton label="Report post" compact intent="danger" secondary onPress={() => void report({ targetType: 'post', targetId: String(post._id), reason: 'Circle post needs safety review' }).catch(() => setError('The report could not be sent.'))} />
          ) : null}
          footer={(
            <PostActionBar
              liked={post.liked}
              likeCount={post.likeCount}
              saved={post.saved}
              commentCount={post.commentCount}
              disabled={!canWrite}
              commentLabel="View comments"
              onLike={() => { if (canWrite) void toggleLike({ postId: post._id as PostId }).catch(() => setError('The reaction could not be updated.')) }}
              onSave={() => { if (canWrite) void toggleSave({ postId: post._id as PostId }).catch(() => setError('The saved post could not be updated.')) }}
              onComment={onToggleComments}
            />
          )}
        >
          <PostContent
            body={post.body}
            mentions={post.mentions}
            media={post.media}
            poll={post.poll}
            disabled={!canWrite}
            imagePressContext="feed"
            onOpenImage={(item, index, total) => setViewerImage({ url: item.url, index, total })}
            onOpenVideo={(url) => openVideo(url)}
            onVote={async (optionId) => { await voteOnPoll({ postId: post._id as PostId, optionId }) }}
          />
          </PostCard>
          {error ? (
            <InlineNotice title="Post action failed" tone="danger">
              {error}
            </InlineNotice>
          ) : null}
          {expanded ? (
            <CircleComments
              postId={post._id as PostId}
              canWrite={canWrite}
              canModerate={canModerate}
              focusCommentId={focusCommentId}
            />
          ) : null}
        </View>
      </BlurTargetView>
      <ModalPostImageViewer image={viewerImage} blurTarget={blurTarget} onClose={() => setViewerImage(null)} />
      <NativeVideoViewer url={videoUrl} onClose={() => setVideoUrl(null)} />
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  authorLink: { maxWidth: '72%', flexShrink: 1 },
  pressed: { opacity: 0.68 },
})
