import type { ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { formatPhp, referralRewardLabel } from '@lets-be-friends/shared'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { Screen } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'
import { ReferralRow, type MobileReferralItem } from './ReferralRow'

export type MobileReferralData = {
  code: string | null
  programActive: boolean
  totalReferrals: number
  totalRewardedBookings: number
  totalEarnedCentavos: number
  totalPendingCentavos: number
  referralCreditAvailableCentavos?: number
  totalReversedCentavos: number
  referralDebtCentavos: number
  canAddReferralCode: boolean
  referredBy: {
    referrerDisplayName: string
    code: string
    rewardedBookings: number
  } | null
}

export type MobileReferralRewardItem = {
  _id: string
  bookingId: string
  kind: string
  amountCentavos: number
  rewardBps: number | null
  status: string
  reviewRequired: boolean
  createdAt: number
  releasedAt: number | null
  referredDisplayName: string
}

export type ReferralPageStatus = 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'

export function referralAvailableCentavos(referral: Pick<MobileReferralData, 'totalEarnedCentavos' | 'referralCreditAvailableCentavos'>) {
  return referral.referralCreditAvailableCentavos ?? referral.totalEarnedCentavos
}

export function ReferralsView({
  referral,
  items,
  rewardItems,
  status,
  rewardStatus,
  busy,
  message,
  shareUrl,
  friendCodeCard,
  onCreateCode,
  onShare,
  onBack,
  onLoadMore,
  onLoadMoreRewards,
  onOpenTerms,
}: {
  referral: MobileReferralData
  items: MobileReferralItem[]
  rewardItems: MobileReferralRewardItem[]
  status: ReferralPageStatus
  rewardStatus: ReferralPageStatus
  busy: boolean
  message: string
  shareUrl?: string
  friendCodeCard?: ReactNode
  onCreateCode: () => void
  onShare: () => void
  onBack: () => void
  onLoadMore: () => void
  onLoadMoreRewards: () => void
  onOpenTerms?: () => void
}) {
  const theme = useAppTheme()
  const availableCentavos = referralAvailableCentavos(referral)
  const hasHeldRewards = rewardItems.some((reward) => reward.status === 'pending' && reward.reviewRequired)
  const panel = [styles.panel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]
  const divider = <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

  const header = (
    <View style={styles.header}>
      <AppHeader title="Referrals" back onBack={onBack} />
      <View style={styles.headerCopy}>
        <AppText variant="title">Invite friends</AppText>
        <AppText color={theme.colors.textMuted}>
          Earn 5% of the booking subtotal on every completed booking your friend makes, for life. No cap.
        </AppText>
      </View>

      {!referral.programActive ? (
        <View style={[styles.notice, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText color={theme.colors.text}>Referrals are paused right now. Existing credit still settles and releases.</AppText>
        </View>
      ) : null}

      {message ? <AppText accessibilityLiveRegion="polite" color={theme.colors.textMuted}>{message}</AppText> : null}

      <View style={panel}>
        {!referral.code ? (
          <View style={styles.stack}>
            <View style={styles.stackTight}>
              <AppText variant="heading">Create your referral link</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>
                Share this link with a friend. You earn 5% of the booking subtotal on every completed booking, for life. Your friend pays the normal price, and the credit comes out of the platform service fee.
              </AppText>
            </View>
            <ActionButton label="Create my referral link" onPress={onCreateCode} intent="social" compact style={styles.startAction} loading={busy} />
          </View>
        ) : (
          <View style={styles.stack}>
            <View style={styles.stackTight}>
              <AppText variant="heading">Your referral link</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>
                Credit lands in your wallet after each booking settles and the 14-day hold clears.
              </AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>
                A friend counts after they add your code, not just after they open the link.
              </AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>
                Your friend must add your code within 30 days of joining and before their first booking. They pay the normal price.
              </AppText>
            </View>
            <View style={[styles.linkRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
              <AppText variant="caption" numberOfLines={1} style={styles.linkText}>{shareUrl ?? 'Your link is being prepared.'}</AppText>
            </View>
            <ActionButton label="Share my link" onPress={onShare} intent="social" />
            <AppText variant="caption" color={theme.colors.textMuted}>
              Your code: <AppText variant="bodyStrong">{referral.code}</AppText>
            </AppText>
          </View>
        )}

        {divider}

        <View style={styles.metricGrid}>
          <Metric label="Friends joined" value={String(referral.totalReferrals)} />
          <Metric label="Rewarded bookings" value={String(referral.totalRewardedBookings)} />
          <Metric label="Referral credit available" value={formatPhp(availableCentavos)} />
          <Metric label="Lifetime credited" value={formatPhp(referral.totalEarnedCentavos)} />
          {referral.totalPendingCentavos > 0 ? (
            <Metric
              label={hasHeldRewards ? 'Pending release or under review' : 'Pending release'}
              value={formatPhp(referral.totalPendingCentavos)}
            />
          ) : null}
          {referral.totalReversedCentavos > 0 ? (
            <Metric label="Reversed" value={formatPhp(referral.totalReversedCentavos)} />
          ) : null}
        </View>
        {hasHeldRewards ? (
          <AppText variant="caption" color={theme.colors.textMuted}>
            Held credit waits for a review. Other credit releases after the 14-day hold.
          </AppText>
        ) : null}
        {referral.referralDebtCentavos > 0 ? (
          <AppText variant="caption" color={theme.colors.textMuted}>
            {formatPhp(referral.referralDebtCentavos)} referral debt will be offset against future credit.
          </AppText>
        ) : null}

        {friendCodeCard ? (
          <>
            {divider}
            {friendCodeCard}
          </>
        ) : null}

        <ViewSection title="Your referrals" count={referral.totalReferrals} />
        {items.length > 0 ? (
          <View>
            {items.map((item) => <ReferralRow key={item._id} item={item} />)}
          </View>
        ) : (
          <AppText variant="caption" color={theme.colors.textMuted}>No friends have added your code yet.</AppText>
        )}
        {status === 'LoadingMore' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.socialText} />
            <AppText variant="caption" color={theme.colors.textMuted}>Loading more referrals...</AppText>
          </View>
        ) : null}

        {divider}

        <ViewSection title="Referral earnings" />
        {rewardItems.length === 0 ? (
          <AppText variant="caption" color={theme.colors.textMuted}>No referral earnings yet. Credit appears after a friend&apos;s booking settles.</AppText>
        ) : (
          <View>
            {rewardItems.map((reward, index) => (
              <View key={reward._id} style={[styles.rewardRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }]}>
                <View style={styles.rewardCopy}>
                  <AppText variant="bodyStrong">{reward.referredDisplayName}</AppText>
                  <AppText variant="caption" color={theme.colors.textMuted}>
                    {referralRewardLabel(reward.kind as 'lifetime' | 'launch_bonus' | undefined, reward.rewardBps)} · {formatRewardDate(reward.createdAt)}
                  </AppText>
                  <AppText variant="caption" color={theme.colors.textMuted}>
                    Booking {reward.bookingId.slice(-6).toUpperCase()}
                  </AppText>
                </View>
                <View style={styles.rewardAmount}>
                  <AppText variant="bodyStrong">{formatPhp(reward.amountCentavos)}</AppText>
                  <AppText variant="caption" color={reward.status === 'reversed' ? theme.colors.danger : theme.colors.textMuted}>
                    {reward.status === 'credited' ? 'Available' : reward.status === 'pending' ? reward.reviewRequired ? 'Under review' : 'Pending release' : 'Reversed'}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        )}
        {rewardStatus === 'CanLoadMore' ? (
          <ActionButton label="Load more earnings" onPress={onLoadMoreRewards} intent="neutral" secondary />
        ) : null}

        {referral.referredBy ? (
          <>
            {divider}
            <View style={[styles.referredBy, { backgroundColor: theme.colors.surfaceRaised }]}>
              <AppText variant="heading">You joined with {referral.referredBy.referrerDisplayName}&apos;s code</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>
                {referral.referredBy.referrerDisplayName} earns 5% of the booking subtotal on every booking you complete. You pay the normal price.
              </AppText>
            </View>
          </>
        ) : null}
      </View>

      {status === 'CanLoadMore' ? (
        <ActionButton label="Load more referrals" onPress={onLoadMore} intent="neutral" secondary />
      ) : null}
      {onOpenTerms ? (
        <ActionButton label="Referral terms" onPress={onOpenTerms} intent="neutral" secondary />
      ) : null}
      <AppText variant="caption" color={theme.colors.textMuted}>
        Credit releases after a 14-day hold and is reversed if an admin reverses it or confirms fraud. Example: a ₱700 booking subtotal earns ₱35. The 5% applies to the booking subtotal, not the member total including the 15% service fee.
      </AppText>
    </View>
  )

  return (
    <Screen contentStyle={styles.content}>
      {header}
    </Screen>
  )
}

function ViewSection({ title, count }: { title: string; count?: number }) {
  const theme = useAppTheme()
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading">{title}</AppText>
      {count !== undefined ? <AppText variant="caption" color={theme.colors.textMuted}>{count}</AppText> : null}
    </View>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme()
  return (
    <View style={[styles.metric, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
      <AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  )
}

function formatRewardDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(timestamp)
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingBottom: 32 },
  header: { gap: 12, paddingTop: 8 },
  headerCopy: { gap: 4 },
  panel: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 14 },
  stack: { gap: 10 },
  stackTight: { gap: 4 },
  divider: { height: StyleSheet.hairlineWidth },
  notice: { borderWidth: 1, borderRadius: 10, padding: 10 },
  linkRow: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10 },
  linkText: { flexShrink: 1 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  startAction: { alignSelf: 'flex-start', paddingHorizontal: 14 },
  metric: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 10, padding: 10, gap: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  rewardRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingTop: 10, marginTop: 10 },
  rewardCopy: { flex: 1, gap: 2 },
  rewardAmount: { alignItems: 'flex-end', gap: 2 },
  referredBy: { borderRadius: 10, padding: 12, gap: 4 },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 12 },
})
