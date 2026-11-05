import { StyleSheet, View } from 'react-native'
import { formatPhp } from '@lets-be-friends/shared'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { Screen } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'
import { ReferralRow } from './ReferralRow'

export type MobileReferralData = {
  code: string | null
  referrals: Array<{
    _id: string
    referredDisplayName: string
    status: string
    rewardedBookings: number
    totalRewardedBookings: number
    createdAt: number
  }>
  rewards: Array<{
    _id: string
    bookingId: string
    amountCentavos: number
    status: string
    createdAt: number
  }>
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

export function ReferralsView({
  referral,
  busy,
  message,
  shareUrl,
  onCreateCode,
  onShare,
  onReturn,
  onViewAll,
}: {
  referral: MobileReferralData
  busy: boolean
  message: string
  shareUrl?: string
  onCreateCode: () => void
  onShare: () => void
  onReturn: () => void
  onViewAll: () => void
}) {
  const theme = useAppTheme()

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.socialText}>INVITE FRIENDS</AppText>
        <AppText variant="title">Share a good thing</AppText>
        <AppText color={theme.colors.textMuted}>
          Earn booking credit equal to 68% of our 15% service fee on each friend's first 3 completed bookings. Friends pay the normal price. Credit lands in your wallet after each booking settles.
        </AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          Example: a ₱700 booking has a ₱105 service fee, and you earn ₱71.40 in credit.
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

      <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <AppText variant="heading">Recent referrals</AppText>
        {referral.referrals.length > 0 ? (
          <>
            {referral.referrals.map((item) => <ReferralRow key={item._id} item={item} />)}
            {referral.totalReferrals > referral.referrals.length ? (
              <ActionButton label="View all referrals" onPress={onViewAll} intent="social" secondary />
            ) : null}
          </>
        ) : (
          <AppText variant="caption" color={theme.colors.textMuted}>No friends have joined with your link yet.</AppText>
        )}
      </View>

      {referral.referredBy && (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
          <AppText variant="heading">You joined with {referral.referredBy.referrerDisplayName}'s code</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            {referral.referredBy.rewardedBookings} of {referral.referredBy.totalRewardedBookings} rewarded bookings on your account.
          </AppText>
        </View>
      )}

      <ActionButton label="Return to Profile" onPress={onReturn} secondary intent="self" />
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
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  header: { gap: 6 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  metrics: { gap: 8 },
  metric: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
})
