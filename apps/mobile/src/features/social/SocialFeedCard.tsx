import type { FunctionReturnType } from 'convex/server'
import { useMutation } from 'convex/react'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { useState } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { api as generatedApi } from '../../../../web/convex/_generated/api'

import { mobileApi, type PostId } from '@/backend/client'
import { formatMessageTimestamp } from '@/data/messageViewModels'
import { postCommentsRoute } from '@/data/socialRoutes'
import { useAppTheme } from '@/theme/ThemeProvider'

import { Avatar } from '@/design-system/atoms/Avatar'
import { IconButton } from '@/design-system/atoms/IconButton'
import { ActionSheet, type ActionSheetItem } from '@/design-system/molecules/ActionSheet'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { ReportAction } from '@/features/safety/ReportAction'
import { AppText } from '@/design-system/atoms/Typography'

import { EditPostSheet } from './EditPostSheet'
import { MentionBody } from './MentionBody'
import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { PostFollowAction } from './PostFollowAction'
import { PostMediaGrid } from './PostMediaGrid'
import { openMemberProfile } from './socialNavigation'
import { CompanionRecommendationCard, GuidanceFeedCard } from './SocialFeedRecommendations'

type FeedItem = FunctionReturnType<typeof generatedApi.social.feedPage>['page'][number]
type FeedAction = 'open_companion' | 'open_guidance' | 'comment' | 'like' | 'save' | 'follow' | 'report' | 'report_comment'

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
  const companion = item.companion
  return (
    <CompanionRecommendationCard
      companion={{ reason: item.reason, displayName: companion.displayName, mode: companion.mode, intro: companion.intro, strengths: companion.strengths, reviewCount: companion.reviewCount, rating: companion.rating }}
      onPress={() => { onAction('open_companion'); router.push({ pathname: '/companion-profile/[id]', params: { id: String(companion._id) } }) }}
    />
  )
}

function GuidanceCard({ item, onAction }: { item: Extract<FeedItem, { kind: 'guidance' }>; onAction: (action: FeedAction) => void }) {
  return <GuidanceFeedCard reason={item.reason} title={item.title} body={item.body} actionLabel={item.actionLabel} onPress={() => { onAction('open_guidance'); router.push('/explore') }} />
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
            onAction('comment')
            router.push(postCommentsRoute(post._id as PostId))
          }}
          onSave={() => void save()}
        />
      )}
    >
      <View style={styles.postBody}>
        {post.body ? <MentionBody body={post.body} mentions={post.mentions} /> : null}
        <PostMediaGrid
          media={post.media}
          imagePressContext="feed"
          onOpenImage={() => router.push(postCommentsRoute(post._id as PostId))}
          onOpenVideo={(url) => void openVideo(url)}
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
      </View>
    </PostCard>
  )
}

const styles = StyleSheet.create({
  postBody: { minWidth: 0, gap: 4 },
  authorLink: { maxWidth: '48%', flexShrink: 1 },
  pressed: { opacity: 0.68 },
})
