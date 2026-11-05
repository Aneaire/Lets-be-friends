import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { Screen } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'
import { ReferralRow, type MobileReferralItem } from './ReferralRow'

export type ReferralPageStatus = 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'

export function ReferralsAllView({
  items,
  status,
  onLoadMore,
  onBack,
}: {
  items: MobileReferralItem[]
  status: ReferralPageStatus
  onLoadMore: () => void
  onBack: () => void
}) {
  const theme = useAppTheme()

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.header}>
        <IconButton label="Back to referrals" icon="chevron-back" onPress={onBack} />
        <AppText variant="title">All referrals</AppText>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <ReferralRow item={item} />}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={status === 'LoadingFirstPage'
          ? <AppText color={theme.colors.textMuted}>Loading referrals...</AppText>
          : <AppText variant="caption" color={theme.colors.textMuted}>No friends have joined with your link yet.</AppText>}
        ListFooterComponent={status === 'CanLoadMore' ? (
          <ActionButton label="Load more" onPress={onLoadMore} intent="social" secondary />
        ) : status === 'LoadingMore' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.socialText} />
            <AppText variant="caption" color={theme.colors.textMuted}>Loading more...</AppText>
          </View>
        ) : null}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  list: { flex: 1 },
  listContent: { gap: 0, paddingBottom: 24 },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 16 },
})
