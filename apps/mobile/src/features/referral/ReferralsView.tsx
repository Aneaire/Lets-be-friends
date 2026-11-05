import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native'
import { formatPhp } from '@lets-be-friends/shared'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { Screen } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'
import { ReferralRow, type MobileReferralItem } from './ReferralRow'

export type MobileReferralData = {
  code: string | null
  totalReferrals: number
  totalRewardedBookings: number
  totalEarnedCentavos: number
  totalReversedCentavos: number
  referredBy: {
    referrerDisplayName: string
    code: string
    rewardedBookings: number
    totalRewardedBookings: number
  } | null
}

export type ReferralPageStatus = 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'

export function ReferralsView({
  referral,
  items,
  status,
  busy,
  message,
  shareUrl,
  onCreateCode,
  onShare,
  onBack,
  onLoadMore,
}: {
  referral: MobileReferralData
  items: MobileReferralItem[]
  status: ReferralPageStatus
  busy: boolean
  message: string
  shareUrl?: string
  onCreateCode: () => void
  onShare: () => void
  onBack: () => void
  onLoadMore: () => void
}) {
  const theme = useAppTheme()

  const header = (
    <View style={styles.header}>
      <View style={styles.topBar}>
        <IconButton label="Back" icon="chevron-back" onPress={onBack} />
      </View>
      <AppText variant="label" color={theme.colors.socialText}>INVITE FRIENDS</AppText>
      <AppText variant="title">Share a good thing</AppText>
      <AppText color={theme.colors.textMuted}>
        Earn booking credit equal to 68% of our 15% service fee on each friend's first 3 completed bookings. Friends pay the normal price. Credit lands in your wallet after each booking settles.
      </AppText>
      <AppText variant="caption" color={theme.colors.textMuted}>
        Example: a ₱700 booking has a ₱105 service fee, and you earn ₱71.40 in credit.
      </AppText>

      {message ? <AppText accessibilityLiveRegion="polite" color={theme.colors.textMuted}>{message}</AppText> : null}

      {!referral.code ? (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="heading">Create your referral link</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Share this link with a friend.
          </AppText>
          <ActionButton label="Create my referral link" onPress={onCreateCode} intent="social" loading={busy} />
        </View>
      ) : (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="heading">Your referral code</AppText>
          <AppText variant="title" color={theme.colors.socialText}>{referral.code}</AppText>
          {shareUrl ? <AppText variant="caption" color={theme.colors.textMuted}>{shareUrl}</AppText> : null}
          <ActionButton label="Share my link" onPress={onShare} intent="social" />
        </View>
      )}

      <View style={styles.metrics}>
        <Metric label="Friends joined" value={String(referral.totalReferrals)} />
        <Metric label="Rewarded bookings" value={String(referral.totalRewardedBookings)} />
        <Metric label="Credit earned" value={formatPhp(referral.totalEarnedCentavos)} />
      </View>

      {referral.referredBy ? (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
          <AppText variant="heading">You joined with {referral.referredBy.referrerDisplayName}'s code</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            {referral.referredBy.rewardedBookings} of {referral.referredBy.totalRewardedBookings} rewarded bookings on your account.
          </AppText>
        </View>
      ) : null}

      <AppText variant="heading">Your referrals</AppText>
    </View>
  )

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <ReferralRow item={item} card />}
        ListHeaderComponent={header}
        ListEmptyComponent={status === 'LoadingFirstPage' ? (
          <AppText color={theme.colors.textMuted}>Loading referrals...</AppText>
        ) : (
          <AppText variant="caption" color={theme.colors.textMuted}>No friends have joined with your link yet.</AppText>
        )}
        ListFooterComponent={status === 'LoadingMore' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.socialText} />
            <AppText variant="caption" color={theme.colors.textMuted}>Loading more referrals...</AppText>
          </View>
        ) : null}
        onEndReached={() => {
          if (status === 'CanLoadMore') onLoadMore()
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme()
  return (
    <View style={[styles.metric, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText>
      <AppText variant="heading" style={styles.metricValue} numberOfLines={1}>{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 8, paddingBottom: 32 },
  header: { gap: 8, paddingTop: 4 },
  topBar: { flexDirection: 'row', alignItems: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  metricValue: { fontSize: 16 },
  listContent: { paddingBottom: 24, gap: 8 },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 16 },
})
