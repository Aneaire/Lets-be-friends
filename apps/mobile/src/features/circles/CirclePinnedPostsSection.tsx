import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { mobileApi, type CircleId, type PostId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

import { canModeratePinnedPosts, circleActionError, pinnedPostItems } from './circlePresentation'

export function CirclePinnedPostsSection({ circleId, canModerate, circleState }: {
  circleId: CircleId
  canModerate: boolean
  circleState?: 'active' | 'archived' | 'suspended'
}) {
  const theme = useAppTheme()
  const pins = useQuery(mobileApi.circles.pinnedPosts, { circleId })
  const unpin = useMutation(mobileApi.circles.unpinPost)
  const [error, setError] = useState('')
  const canUnpin = canModeratePinnedPosts({ canModerate, circleState })

  if (pins === undefined) return <AppText color={theme.colors.textMuted}>Loading pinned posts...</AppText>
  const items = pinnedPostItems(pins)
  if (items.length === 0) return null

  return (
    <View style={styles.section} accessibilityLabel="Pinned posts">
      <View style={styles.heading}>
        <AppText variant="heading">Pinned by hosts</AppText>
        <AppText color={theme.colors.textMuted}>{items.length}</AppText>
      </View>
      {error ? <AppText color={theme.colors.danger}>{error}</AppText> : null}
      {items.map((post) => (
        <View key={post._id} style={[styles.pin, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={styles.copy}>
            <AppText variant="bodyStrong">{post.authorDisplayName}</AppText>
            <AppText numberOfLines={3}>{post.body}</AppText>
          </View>
          {canUnpin ? (
            <ActionButton
              compact
              label={`Unpin post by ${post.authorDisplayName}`}
              intent="neutral"
              secondary
              onPress={() => Alert.alert('Unpin this post?', 'Members will still find it in discussions.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Unpin post', onPress: () => void unpin({ circleId, postId: post._id as PostId }).catch((cause) => setError(circleActionError(cause, 'The post could not be unpinned.'))) },
              ])}
            />
          ) : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pin: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 8 },
  copy: { gap: 2 },
})
