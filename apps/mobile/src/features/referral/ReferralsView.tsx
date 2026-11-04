import { StyleSheet, TextInput, View } from 'react-native'
import { formatPhp, normalizeReferralCode } from '@lets-be-friends/shared'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { Screen } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'

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
  codeInput,
  shareUrl,
  onCodeInputChange,
  onCreateCode,
  onShare,
  onSubmitCode,
  onReturn,
}: {
  referral: MobileReferralData
  busy: boolean
  message: string
  codeInput: string
  shareUrl?: string
  onCodeInputChange: (value: string) => void
  onCreateCode: () => void
  onShare: () => void
  onSubmitCode: () => void
  onReturn: () => void
}) {
  const theme = useAppTheme()
  const rewardedBookings = referral.referrals.reduce((total, item) => total + item.rewardedBookings, 0)

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.socialText}>INVITE FRIENDS</AppText>
        <AppText variant="title">Share a good thing</AppText>
        <AppText color={theme.colors.textMuted}>
          Earn 68% of our service fee on each friend's first 3 completed bookings. Friends pay the normal price.
        </AppText>
      </View>

      {message ? <AppText accessibilityLiveRegion="polite" color={theme.colors.textMuted}>{message}</AppText> : null}

      {!referral.code ? (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="heading">Create your referral link</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Share one link. When a friend completes a booking, your credit lands in your wallet after settlement.
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
        <Metric label="Friends joined" value={String(referral.referrals.length)} />
        <Metric label="Rewarded bookings" value={String(rewardedBookings)} />
        <Metric label="Credit earned" value={formatPhp(referral.totalEarnedCentavos)} />
      </View>

      {referral.referrals.length > 0 ? (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="heading">Your referrals</AppText>
          {referral.referrals.map((item) => (
            <View key={item._id} style={[styles.row, { borderTopColor: theme.colors.border }]}>
              <View style={styles.rowCopy}>
                <AppText variant="bodyStrong">{item.referredDisplayName}</AppText>
                <AppText variant="caption" color={theme.colors.textMuted}>
                  {item.rewardedBookings} of {item.totalRewardedBookings} bookings rewarded
                </AppText>
              </View>
              <AppText variant="caption" color={theme.colors.textMuted}>{item.status}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      {referral.referredBy ? (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
          <AppText variant="heading">You joined with {referral.referredBy.referrerDisplayName}'s code</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            {referral.referredBy.rewardedBookings} of {referral.referredBy.totalRewardedBookings} rewarded bookings on your account.
          </AppText>
        </View>
      ) : (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="heading">Have a friend's code?</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Add it before your first booking. One code per account.
          </AppText>
          <TextInput
            accessibilityLabel="Referral code"
            value={codeInput}
            onChangeText={(value) => onCodeInputChange(normalizeReferralCode(value))}
            placeholder="ABCD1234"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            editable={!busy}
            style={[
              styles.input,
              theme.typography.body,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surfaceRaised,
                borderColor: theme.colors.border,
              },
            ]}
          />
          <ActionButton label="Add referral code" onPress={onSubmitCode} intent="social" loading={busy} disabled={!codeInput.trim()} />
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
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowCopy: { flex: 1, gap: 2 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
})
