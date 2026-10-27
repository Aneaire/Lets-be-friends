import type { ReactNode, RefObject } from 'react'
import { StyleSheet } from 'react-native'
import type { ScrollView } from 'react-native'

import { NotificationTargetAnchor } from '@/features/notifications/NotificationTargetAnchor'
import { density } from '@/theme/tokens'

export function ReviewCommentAnchor({ focused, scrollRef, children }: { focused: boolean; scrollRef: RefObject<ScrollView | null>; children: ReactNode }) {
  return (
    <NotificationTargetAnchor focused={focused} scrollRef={scrollRef} style={styles.comment}>
      {children}
    </NotificationTargetAnchor>
  )
}

const styles = StyleSheet.create({
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: density.cardGap },
})
