import { useMutation, useQuery } from 'convex/react'
import { BlurTargetView } from 'expo-blur'
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { mobileApi, type CircleId, type PostId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { StateView } from '@/design-system/molecules/StateView'
import { ModalPostImageViewer } from '@/features/media/ModalPostImageViewer'
import { NativeVideoViewer } from '@/features/media/NativeVideoViewer'
import { PostMediaGrid } from '@/features/social/PostMediaGrid'
import type { PostViewerImage } from '@/features/social/PostImageViewer'
import { useAppTheme } from '@/theme/ThemeProvider'

import { circleActionError } from './circlePresentation'

type PendingPost = {
  _id: string
  body: string
  media: Array<{ storageId: string; kind: string; url?: string | null }>
  poll?: { question: string; options: Array<{ id: string; label: string }> } | null
  createdAt: number
  authorId: string
  authorDisplayName: string
  authorUsername?: string | null
  authorProfileImageUrl?: string | null
}

export type PendingDecision = 'approve' | 'reject'

/**
 * Leader approval queue. Approve is neutral and reject is danger, each with
 * an inline confirmation step so the decision is explicit on every device.
 */
export function CirclePendingQueue({ circleId }: { circleId: CircleId }) {
  const pending = useQuery(mobileApi.circles.pendingCirclePosts, { circleId })
  const approve = useMutation(mobileApi.circles.approveCirclePost)
  const reject = useMutation(mobileApi.circles.rejectCirclePost)
  const [confirm, setConfirm] = useState<{ postId: string; decision: PendingDecision } | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [viewerImage, setViewerImage] = useState<PostViewerImage | null>(null)
  const blurTarget = useRef<View>(null)
  const [error, setError] = useState('')

  async function decide(postId: string, decision: PendingDecision) {
    const key = `${decision}:${postId}`
    setBusyKey(key)
    setError('')
    try {
      if (decision === 'approve') await approve({ postId: postId as PostId })
      else await reject({ postId: postId as PostId })
      setConfirm(null)
    } catch (cause) {
      setError(circleActionError(cause, 'The decision could not be saved.'))
    } finally {
      setBusyKey(null)
    }
  }

  function openVideo(url: string) {
    setError('')
    setVideoUrl(url)
  }

  if (pending === undefined) return <StateView embedded loading title="Loading posts waiting for approval" />
  return (
    <>
      <BlurTargetView ref={blurTarget} importantForAccessibility={viewerImage ? 'no-hide-descendants' : 'auto'}>
        <CirclePendingQueueView
          posts={pending as PendingPost[]}
          busyKey={busyKey}
          confirm={confirm}
          error={error}
          onAskConfirm={(postId, decision) => {
            setError('')
            setConfirm({ postId, decision })
          }}
          onCancelConfirm={() => setConfirm(null)}
          onDecide={(postId, decision) => void decide(postId, decision)}
          onOpenImage={(item, index, total) => setViewerImage({ url: item.url, index, total })}
          onOpenVideo={(url) => openVideo(url)}
        />
      </BlurTargetView>
      <ModalPostImageViewer image={viewerImage} blurTarget={blurTarget} onClose={() => setViewerImage(null)} />
      <NativeVideoViewer url={videoUrl} onClose={() => setVideoUrl(null)} />
    </>
  )
}

export function CirclePendingQueueView({
  posts,
  busyKey,
  confirm,
  error,
  onAskConfirm,
  onCancelConfirm,
  onDecide,
  onOpenImage,
  onOpenVideo,
}: {
  posts: PendingPost[]
  busyKey: string | null
  confirm: { postId: string; decision: PendingDecision } | null
  error: string
  onAskConfirm: (postId: string, decision: PendingDecision) => void
  onCancelConfirm: () => void
  onDecide: (postId: string, decision: PendingDecision) => void
  onOpenImage: (item: { storageId: string; kind: string; url: string }, index: number, total: number) => void
  onOpenVideo: (url: string) => void
}) {
  const theme = useAppTheme()
  return (
    <View style={styles.queue}>
      <View style={styles.heading}>
        <AppText variant="heading">Pending posts</AppText>
        <AppText color={theme.colors.textMuted}>{posts.length}</AppText>
      </View>
      <AppText color={theme.colors.textMuted}>
        New member posts stay hidden until a leader approves them. Approval posts them to the Circle immediately.
      </AppText>
      {error ? (
        <InlineNotice title="Decision not saved" tone="danger">
          {error}
        </InlineNotice>
      ) : null}
      {posts.length === 0 ? (
        <StateView embedded title="No posts waiting for approval" />
      ) : (
        <View style={styles.list}>
          {posts.map((post) => {
            const date = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(post.createdAt)
            const confirming = confirm?.postId === String(post._id) ? confirm.decision : null
            const busy = busyKey !== null
            return (
              <View key={String(post._id)} style={[styles.card, { borderColor: theme.colors.border }]}>
                <AppText variant="bodyStrong">{post.authorDisplayName}</AppText>
                <AppText variant="caption" color={theme.colors.textMuted}>
                  {post.authorUsername ? `@${post.authorUsername} · ` : ''}{date}
                </AppText>
                {post.body ? <AppText>{post.body}</AppText> : null}
                {post.media.length > 0 ? <PostMediaGrid media={post.media} onOpenImage={onOpenImage} onOpenVideo={onOpenVideo} /> : null}
                {post.poll ? (
                  <View style={styles.poll}>
                    <AppText variant="bodyStrong">{post.poll.question}</AppText>
                    {post.poll.options.map((option) => (
                      <AppText key={option.id} color={theme.colors.textMuted}>
                        {option.label}
                      </AppText>
                    ))}
                  </View>
                ) : null}
                {confirming ? (
                  <View style={styles.confirm}>
                    <AppText variant="bodyStrong">
                      {confirming === 'approve'
                        ? `Approve this post by ${post.authorDisplayName}?`
                        : `Reject this post by ${post.authorDisplayName}? It stays hidden from members.`}
                    </AppText>
                    <View style={styles.row}>
                      <ActionButton
                        compact
                        label={busyKey ? 'Saving' : confirming === 'approve' ? 'Confirm approve' : 'Confirm reject'}
                        intent={confirming === 'approve' ? 'neutral' : 'danger'}
                        loading={busy}
                        onPress={() => onDecide(String(post._id), confirming)}
                      />
                      <ActionButton compact label="Cancel" intent="neutral" secondary disabled={busy} onPress={onCancelConfirm} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <ActionButton
                      compact
                      label={`Approve ${post.authorDisplayName}'s post`}
                      intent="neutral"
                      disabled={busy}
                      onPress={() => onAskConfirm(String(post._id), 'approve')}
                    />
                    <ActionButton
                      compact
                      label={`Reject ${post.authorDisplayName}'s post`}
                      intent="danger"
                      secondary
                      disabled={busy}
                      onPress={() => onAskConfirm(String(post._id), 'reject')}
                    />
                  </View>
                )}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  queue: { gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 8 },
  poll: { gap: 2 },
  confirm: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
