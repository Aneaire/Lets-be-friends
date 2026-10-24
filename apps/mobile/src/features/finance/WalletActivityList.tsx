import { Pressable, StyleSheet, View } from 'react-native'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density, type ThemeColors } from '@/theme/tokens'
import type { WalletActivityRow, WalletActivityTone } from '@/data/walletActivity'

export function WalletActivityList({
  rows,
  emptyMessage = 'No wallet activity yet.',
  onOpenBooking,
}: {
  rows: readonly WalletActivityRow[]
  emptyMessage?: string
  onOpenBooking?: (bookingId: string) => void
}) {
  const theme = useAppTheme()

  if (rows.length === 0) {
    return <AppText color={theme.colors.textMuted}>{emptyMessage}</AppText>
  }

  return (
    <View>
      {rows.map((row, index) => {
        const content = (
          <>
            <View style={[styles.icon, { backgroundColor: toneBackground(theme.colors, row.tone) }]}>
              <AppIcon name={row.icon} color={toneColor(theme.colors, row.tone)} size={17} />
            </View>
            <View style={styles.copy}>
              <AppText variant="bodyStrong" numberOfLines={1}>{row.label}</AppText>
              <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{row.detail}</AppText>
            </View>
            <View style={styles.amount}>
              <AppText
                variant="bodyStrong"
                color={row.direction === 'credit'
                  ? theme.colors.success
                  : row.direction === 'hold'
                    ? theme.colors.textMuted
                    : theme.colors.text}>
                {row.amountLabel}
              </AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>{row.timeLabel}</AppText>
            </View>
          </>
        )
        const rowStyle = [
          styles.row,
          index < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
        ]

        return row.bookingId && onOpenBooking
          ? (
              <Pressable
                key={row.key}
                accessibilityRole="button"
                accessibilityLabel={`${row.label}, ${row.amountLabel}, ${row.detail}. Open booking.`}
                onPress={() => onOpenBooking(row.bookingId as string)}
                style={({ pressed }) => [rowStyle, pressed && styles.pressed]}>
                {content}
              </Pressable>
            )
          : <View key={row.key} style={rowStyle}>{content}</View>
      })}
    </View>
  )
}

function toneColor(colors: ThemeColors, tone: WalletActivityTone) {
  switch (tone) {
    case 'social':
      return colors.social
    case 'success':
      return colors.success
    case 'warning':
      return colors.warning
    case 'danger':
      return colors.danger
    case 'neutral':
      return colors.text
  }
}

function toneBackground(colors: ThemeColors, tone: WalletActivityTone) {
  switch (tone) {
    case 'social':
      return colors.socialSoft
    case 'success':
      return colors.successSoft
    case 'warning':
      return colors.warningSoft
    case 'danger':
    case 'neutral':
      return colors.surface
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: density.cardGap, paddingVertical: density.compactCardPadding },
  pressed: { opacity: 0.7 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: density.textPairGap },
  amount: { alignItems: 'flex-end', gap: density.textPairGap, flexShrink: 0 },
})
