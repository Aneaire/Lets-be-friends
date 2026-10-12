import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { mobileApi, type CircleId, type CommentId, type PostId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { StateView } from '@/design-system/molecules/StateView'
import { useAppTheme } from '@/theme/ThemeProvider'

import { circleActionError } from './circlePresentation'

export type RemovedCircleItem = {
  kind: 'post' | 'comment'
  id: string
  body: string
}

/**
 * Moderator recovery queue. Mounted for every active-Circle moderator, never
 * gated on host ownership. Host settings and ownership stay in Manage.
 */
export function CircleRemovedContent({ circleId, circleState }: {
  circleId: CircleId
  circleState?: 'active' | 'archived' | 'suspended'
}) {
  const removed = useQuery(mobileApi.circles.removedContent, circleState === 'active' ? { circleId } : 'skip')
  const restorePost = useMutation(mobileApi.circles.setPostRemoved)
  const restoreComment = useMutation(mobileApi.circles.setCommentRemoved)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function restore(item: RemovedCircleItem) {
    setBusyId(item.id)
    setError('')
    try {
      if (item.kind === 'post') await restorePost({ postId: item.id as PostId, removed: false })
      else await restoreComment({ commentId: item.id as CommentId, removed: false })
      setConfirmId(null)
    } catch (cause) {
      setError(circleActionError(cause, 'The content could not be restored.'))
    } finally {
      setBusyId(null)
    }
  }

  if (circleState !== 'active') {
    return (
      <InlineNotice title="Removed content is read-only" tone="neutral">
        Reactivate this Circle to review and restore removed content.
      </InlineNotice>
    )
  }
  if (removed === undefined) return <StateView embedded loading title="Loading removed content" />
  return (
    <CircleRemovedContentView
      items={removed as RemovedCircleItem[]}
      confirmId={confirmId}
      busyId={busyId}
      error={error}
      onAskConfirm={(item) => {
        setError('')
        setConfirmId(item.id)
      }}
      onCancelConfirm={() => setConfirmId(null)}
      onRestore={(item) => void restore(item)}
    />
  )
}

export function CircleRemovedContentView({
  items,
  confirmId,
  busyId,
  error,
  onAskConfirm,
  onCancelConfirm,
  onRestore,
}: {
  items: RemovedCircleItem[]
  confirmId: string | null
  busyId: string | null
  error: string
  onAskConfirm: (item: RemovedCircleItem) => void
  onCancelConfirm: () => void
  onRestore: (item: RemovedCircleItem) => void
}) {
  const theme = useAppTheme()
  return (
    <View style={styles.queue}>
      <View style={styles.heading}>
        <AppText variant="heading">Removed content</AppText>
        <AppText color={theme.colors.textMuted}>{items.length}</AppText>
      </View>
      <AppText color={theme.colors.textMuted}>
        Removed posts and comments stay hidden from members until a leader restores them.
      </AppText>
      {error ? (
        <InlineNotice title="Restore failed" tone="danger">
          {error}
        </InlineNotice>
      ) : null}
      {items.length === 0 ? (
        <StateView embedded title="No removed content" detail="Nothing is waiting to be restored." />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <View key={`${item.kind}-${item.id}`} style={[styles.card, { borderColor: theme.colors.border }]}>
              <AppText variant="bodyStrong">{item.kind === 'post' ? 'Removed post' : 'Removed comment'}</AppText>
              <AppText numberOfLines={4}>{item.body}</AppText>
              {confirmId === item.id ? (
                <View style={styles.confirm}>
                  <AppText color={theme.colors.textMuted}>
                    Restore this {item.kind}? Members will see it in the Circle again.
                  </AppText>
                  <View style={styles.row}>
                    <ActionButton
                      compact
                      label={busyId === item.id ? 'Restoring' : `Confirm restore ${item.kind}`}
                      intent="neutral"
                      loading={busyId === item.id}
                      onPress={() => onRestore(item)}
                    />
                    <ActionButton compact label="Cancel" intent="neutral" secondary disabled={busyId === item.id} onPress={onCancelConfirm} />
                  </View>
                </View>
              ) : (
                <ActionButton
                  compact
                  label={`Restore ${item.kind}`}
                  intent="neutral"
                  disabled={busyId !== null}
                  onPress={() => onAskConfirm(item)}
                />
              )}
            </View>
          ))}
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
  confirm: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
