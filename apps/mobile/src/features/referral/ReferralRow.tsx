import { StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

export type MobileReferralItem = {
  _id: string
  referredDisplayName: string
  status: string
  rewardedBookings: number
  totalRewardedBookings: number
}

export function ReferralRow({ item }: { item: MobileReferralItem }) {
  const theme = useAppTheme()
  return (
    <View style={[styles.row, { borderTopColor: theme.colors.border }]}>
      <View style={styles.rowCopy}>
        <AppText variant="bodyStrong">{item.referredDisplayName}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          {item.rewardedBookings} of {item.totalRewardedBookings} bookings rewarded
        </AppText>
      </View>
      <AppText variant="caption" color={theme.colors.textMuted}>{item.status}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowCopy: { flex: 1, gap: 2 },
})
