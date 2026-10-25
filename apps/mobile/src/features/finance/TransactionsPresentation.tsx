import { Pressable, StyleSheet, View } from 'react-native'

import type { WalletActivityRow } from '@/data/walletActivity'
import { AppText } from '@/design-system/atoms/Typography'
import { Screen } from '@/design-system/templates/Screen'
import { WalletActivityList } from '@/features/finance/WalletActivityList'
import { TRANSACTIONS_DESCRIPTION } from '@/features/finance/transactions'
import { useAppTheme } from '@/theme/ThemeProvider'

export function TransactionsPresentation({
  rows,
  onBack,
  onOpenBooking,
}: {
  rows: readonly WalletActivityRow[] | undefined
  onBack: () => void
  onOpenBooking: (bookingId: string) => void
}) {
  const theme = useAppTheme()

  return (
    <Screen contentStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to bookings"
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <AppText variant="label" color={theme.colors.socialText}>‹ BACK TO BOOKINGS</AppText>
      </Pressable>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.textMuted}>YOUR MONEY</AppText>
        <AppText variant="title">Transactions</AppText>
        <AppText color={theme.colors.textMuted}>{TRANSACTIONS_DESCRIPTION}</AppText>
      </View>
      <View style={styles.history}>
        {rows === undefined ? (
          <AppText
            variant="caption"
            color={theme.colors.textMuted}
            accessibilityLiveRegion="polite">
            Loading transactions
          </AppText>
        ) : (
          <WalletActivityList
            rows={rows}
            emptyMessage="No wallet activity yet."
            onOpenBooking={onOpenBooking}
          />
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  pressed: { opacity: 0.7 },
  header: { gap: 4 },
  history: { gap: 10 },
})
