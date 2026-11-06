import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native'
import { formatPhp } from '@lets-be-friends/shared'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { AppHeader } from '@/design-system/molecules/AppHeader'
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
      <AppHeader title="Referrals" back onBack={onBack} />
      <View style={styles.headerCopy}>
        <AppText variant="label" color={theme.colors.socialText}>REFERRALS</AppText>
        <AppText variant="title">Invite friends</AppText>
        <AppText color={theme.colors.textMuted}>
          Earn booking credit when friends complete their first 3 bookings.
        </AppText>
      </View>

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
          <AppText variant="heading">Your referral link</AppText>
          {shareUrl ? <AppText variant="caption" color={theme.colors.textMuted}>{shareUrl}</AppText> : null}
          <ActionButton label="Share my link" onPress={onShare} intent="social" />
          <AppText variant="caption" color={theme.colors.textMuted}>
            Your code: <AppText variant="bodyStrong" color={theme.colors.text}>{referral.code}</AppText>
          </AppText>
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
        ListFooterComponent={(
          <View style={styles.footer}>
            {status === 'LoadingMore' ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.colors.socialText} />
                <AppText variant="caption" color={theme.colors.textMuted}>Loading more referrals...</AppText>
              </View>
            ) : null}
            <AppText variant="caption" color={theme.colors.textMuted}>
              You earn 68% of our 15% service fee on each friend's first 3 completed bookings. Example: a ₱700 booking earns ₱71.40.
            </AppText>
          </View>
        )}
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
      <AppText variant="heading">{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 5, paddingBottom: 32 },
  header: { gap: 8, paddingTop: 8 },
  headerCopy: { gap: 4 },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  metrics: { gap: 8 },
  metric: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  listContent: { paddingBottom: 24, gap: 8 },
  footer: { gap: 8, paddingTop: 8 },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 16 },
})
