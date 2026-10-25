import type { FunctionReturnType } from 'convex/server'
import { useMutation } from 'convex/react'
import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native'

import { mobileApi, type PostId } from '@/backend/client'
import { formatMessageTimestamp } from '@/data/messageViewModels'
import { postCommentsRoute } from '@/data/socialRoutes'
import { useAppTheme } from '@/theme/ThemeProvider'

import { Avatar } from '@/design-system/atoms/Avatar'
import { IconButton } from '@/design-system/atoms/IconButton'
import { ActionSheet, type ActionSheetItem } from '@/design-system/molecules/ActionSheet'
import { useAppToastMessage, showAppToast } from '@/design-system/molecules/AppToast'
import { ReportAction } from '@/features/safety/ReportAction'
import { AppText } from '@/design-system/atoms/Typography'

import { EditPostSheet } from './EditPostSheet'
import { NativeVideoViewer } from '@/features/media/NativeVideoViewer'
import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { PostContent } from './PostContent'
import type { PostViewerImage } from './PostImageViewer'
import { PostFollowAction } from './PostFollowAction'
import { ShareSheet } from './ShareSheet'
import { postShareUrl } from './shareLinks'
import { openMemberProfile } from './socialNavigation'

/**
 * Shared post view for the Home feed and profile surfaces.
 * Both `feedPage` and `byUser` return `enrichPost` results, so the exact
 * `byUser` post type covers the shared renderer without a lossy adapter.
 */
export type SocialPostView = FunctionReturnType<typeof mobileApi.social.byUser>[number]

export type SocialPostAction = 'open_companion' | 'open_guidance' | 'open_review' | 'comment' | 'like' | 'save' | 'share' | 'follow' | 'report' | 'report_comment'

export function SocialPostCard({ post, signedIn, following, followBusy = false, onToggleFollow, onOpenImage, onAction }: {
  post: SocialPostView
  signedIn: boolean
  following: boolean
  followBusy?: boolean
  onToggleFollow?: (authorId: string) => Promise<boolean | undefined>
  /**
   * Direct photo viewer handler. Home and profile screens pass their
   * feed-level lightbox so photo taps open full screen without leaving the
   * surface. When omitted, taps fall back to opening the post comments thread.
   */
  onOpenImage?: (image: PostViewerImage) => void
  onAction: (action: SocialPostAction) => void
}) {
  const theme = useAppTheme()
  const toggleLike = useMutation(mobileApi.social.toggleLike)
  const toggleSave = useMutation(mobileApi.social.toggleSavePost)
  const voteOnPoll = useMutation(mobileApi.social.voteOnPoll)
  const editPost = useMutation(mobileApi.social.editPost)
  const deletePost = useMutation(mobileApi.social.deletePost)
  const createPost = useMutation(mobileApi.social.createPost)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(post.body ?? '')
  const [busy, setBusy] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
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

  function openVideo(url: string) {
    setError('')
    setVideoUrl(url)
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

  function openShare() {
    setOptionsOpen(false)
    setTimeout(() => setShareOpen(true), 220)
  }

  const shareUrl = postShareUrl(String(post._id))

  async function sharePostLink() {
    if (!shareUrl) {
      setError('Sharing needs the web app URL configured.')
      return
    }
    await Share.share({ message: shareUrl })
    setError('')
    onAction('share')
  }

  async function sharePostToFeed(note: string) {
    await createPost({ body: note, sharedPostId: post._id as PostId })
    setError('')
    onAction('share')
    showAppToast('Shared to your feed.', 'success')
  }

  const optionItems: ActionSheetItem[] = post.ownPost
    ? [
        { label: 'Share post', icon: 'share-social-outline', tone: 'self', onPress: openShare },
        { label: 'Edit post', icon: 'create-outline', tone: 'self', onPress: editFromOptions },
        { label: 'Delete post', icon: 'trash-outline', tone: 'danger', onPress: deleteFromOptions },
      ]
    : [
        { label: 'Share post', icon: 'share-social-outline', tone: 'social', onPress: openShare },
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
      username={post.authorUsername}
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
          <Avatar uri={post.authorProfileImageUrl ?? undefined} name={post.authorDisplayName} size={42} />
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
      context={post.profilePictureUpdate ? (
        <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>Profile picture update</AppText>
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
            onAction('comment')
            router.push(postCommentsRoute(post._id as PostId))
          }}
          onSave={() => void save()}
          onShare={signedIn ? openShare : undefined}
        />
      )}
    >
      <View style={styles.postBody}>
        <PostContent
          body={post.body}
          mentions={post.mentions}
          media={post.media}
          poll={post.poll}
          featuredComment={post.featuredComment}
          disabled={!signedIn || busy}
          imagePressContext="feed"
          onOpenImage={(media, index, total) => {
            if (onOpenImage) {
              onOpenImage({ url: media.url, index, total })
              return
            }
            router.push(postCommentsRoute(post._id as PostId))
          }}
          onOpenVideo={(url) => openVideo(url)}
          onVote={async (optionId) => {
            await voteOnPoll({ postId: post._id as PostId, optionId })
          }}
          onOpenFeaturedThread={() => {
            onAction('comment')
            router.push(postCommentsRoute(post._id as PostId))
          }}
        />
        {!post.ownPost && signedIn ? <ReportAction targetType="post" targetId={String(post._id)} label="Report post" open={reportOpen} onOpenChange={setReportOpen} showTrigger={false} onReported={() => onAction('report')} /> : null}
        <ActionSheet
          visible={optionsOpen}
          title={post.ownPost ? 'Your post' : 'Post options'}
          items={optionItems}
          onClose={() => setOptionsOpen(false)}
        />
        <EditPostSheet
          visible={editing}
          body={editBody}
          busy={busy}
          allowEmpty={post.media.length > 0}
          onBodyChange={setEditBody}
          onSave={() => void saveEdit()}
          onClose={() => setEditing(false)}
        />
        <ShareSheet
          visible={shareOpen}
          title="Share post"
          previewLabel={`Post by ${post.authorDisplayName}`}
          previewBody={post.body}
          onShareToFeed={sharePostToFeed}
          onShareLink={sharePostLink}
          onClose={() => setShareOpen(false)}
        />
        <NativeVideoViewer url={videoUrl} onClose={() => setVideoUrl(null)} />
      </View>
    </PostCard>
  )
}

const styles = StyleSheet.create({
  postBody: { minWidth: 0, gap: 4 },
  authorLink: { maxWidth: '72%', flexShrink: 1 },
  pressed: { opacity: 0.68 },
})
