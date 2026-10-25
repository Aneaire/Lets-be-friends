import { Pressable, StyleSheet, View } from 'react-native'

import { formatPhp } from '@lets-be-friends/shared'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import type { MobileMemberState } from '@/member/MobileMember'

export const BOOKINGS_WALLET_ROUTE = '/wallet' as const

export type BookingsWallet = {
  availableCentavos: number
} | null | undefined

export function bookingsWalletQueryArgs(status: MobileMemberState['status']) {
  return status === 'ready' ? {} : ('skip' as const)
}

export function bookingsWalletPresentation(wallet: BookingsWallet) {
  if (wallet === undefined) {
    return {
      state: 'loading' as const,
      label: 'Balance loading…',
      accessibilityLabel: 'Open wallet, balance loading',
    }
  }
  if (wallet === null) {
    return {
      state: 'unavailable' as const,
      label: 'Balance unavailable',
      accessibilityLabel: 'Open wallet, balance unavailable',
    }
  }
  const formatted = formatPhp(wallet.availableCentavos)
  return {
    state: 'ready' as const,
    label: formatted,
    accessibilityLabel: `Open wallet, available balance ${formatted}`,
  }
}

export function BookingsHeader({
  wallet,
  onOpenWallet,
}: {
  wallet: BookingsWallet
  onOpenWallet: () => void
}) {
  const theme = useAppTheme()
  const presentation = bookingsWalletPresentation(wallet)

  return (
    <View style={styles.header}>
      <AppText variant="title">Bookings</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={presentation.accessibilityLabel}
        accessibilityHint="Open your booking wallet with top-up and withdrawal history."
        onPress={onOpenWallet}
        hitSlop={8}
        style={({ pressed }) => [styles.balanceHitTarget, pressed && styles.pressed]}>
        <View
          style={[
            styles.balancePill,
            { backgroundColor: theme.colors.selfSoft, borderColor: theme.colors.selfText },
          ]}>
          <AppText variant="label" color={theme.colors.selfText} style={styles.balanceText}>
            {presentation.label}
          </AppText>
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    paddingTop: 16,
    marginBottom: 16,
  },
  balanceHitTarget: {
    minHeight: density.compactControlHeight,
    justifyContent: 'center',
    flexShrink: 1,
    maxWidth: '100%',
  },
  balancePill: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: density.controlRadius,
    flexShrink: 1,
    maxWidth: '100%',
  },
  balanceText: {
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  pressed: { opacity: 0.7 },
})
