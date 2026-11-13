import type { ReactNode } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native'
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

export function referralAvailableCentavos(referral: Pick<MobileReferralData, 'totalEarnedCentavos' | 'referralCreditAvailableCentavos'>) {
  return referral.referralCreditAvailableCentavos ?? referral.totalEarnedCentavos
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

  const header = (
    <View style={styles.header}>
      <AppHeader title="Referrals" back onBack={onBack} />
      <View style={styles.headerCopy}>
        <AppText variant="title">Invite friends</AppText>
        <AppText color={theme.colors.textMuted}>
          Earn 5% of the booking subtotal on every completed booking your friend makes, for life.
        </AppText>
      </View>

      {!referral.programActive ? (
        <View style={[styles.notice, { borderColor: theme.colors.danger, backgroundColor: theme.colors.surface }]}>
          <AppText color={theme.colors.danger}>Referrals are paused right now. Existing credit still settles and releases.</AppText>
        </View>
      ) : null}

      {friendCodeCard}

      {message ? <AppText accessibilityLiveRegion="polite" color={theme.colors.textMuted}>{message}</AppText> : null}

      {!referral.code ? (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="heading">Create your referral link</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Share this link with a friend. You earn 5% of the booking subtotal on every completed booking, for life.
          </AppText>
          <ActionButton label="Create my referral link" onPress={onCreateCode} intent="social" loading={busy} />
        </View>
      ) : (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="heading">Your referral link</AppText>
          {shareUrl ? <AppText variant="caption" color={theme.colors.textMuted}>{shareUrl}</AppText> : null}
          <ActionButton label="Share my link" onPress={onShare} intent="social" />
          <AppText variant="caption" color={theme.colors.textMuted}>
            A friend counts after they add your code, not just after they open the link.
          </AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Your friend must add your code within 30 days of joining and before their first booking.
          </AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Your code: <AppText variant="bodyStrong" color={theme.colors.text}>{referral.code}</AppText>
          </AppText>
        </View>
      )}

      <View style={styles.metrics}>
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
      </View>

      {referral.referredBy ? (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
          <AppText variant="heading">You joined with {referral.referredBy.referrerDisplayName}&apos;s code</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            {referral.referredBy.referrerDisplayName} earns 5% of the booking subtotal on every booking you complete.
          </AppText>
        </View>
      ) : null}

      <AppText variant="heading">Your referrals</AppText>
    </View>
  )

  const footer = (
    <View style={styles.footer}>
      {status === 'LoadingMore' ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.socialText} />
          <AppText variant="caption" color={theme.colors.textMuted}>Loading more referrals...</AppText>
        </View>
      ) : null}

      <AppText variant="heading">Referral earnings</AppText>
      {rewardItems.length === 0 ? (
        <AppText variant="caption" color={theme.colors.textMuted}>No referral earnings yet. Credit appears after a friend&apos;s booking settles.</AppText>
      ) : (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          {rewardItems.map((reward) => (
            <View key={reward._id} style={[styles.rewardRow, { borderColor: theme.colors.border }]}>
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
      {onOpenTerms ? (
        <ActionButton label="Referral terms" onPress={onOpenTerms} intent="neutral" secondary />
      ) : null}
      <AppText variant="caption" color={theme.colors.textMuted}>
        You earn 5% of the booking subtotal on every completed booking your friend makes, for life. Credit releases after a 14-day hold. Example: a ₱700 booking subtotal earns ₱35. The 5% applies to the booking subtotal, not the member total including the service fee.
      </AppText>
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
          <AppText variant="caption" color={theme.colors.textMuted}>No friends have added your code yet.</AppText>
        )}
        ListFooterComponent={footer}
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

function formatRewardDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(timestamp)
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
  notice: { borderWidth: 1, borderRadius: 12, padding: 10 },
  rewardRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, paddingTop: 8 },
  rewardCopy: { flex: 1, gap: 2 },
  rewardAmount: { alignItems: 'flex-end', gap: 2 },
  listContent: { paddingBottom: 24, gap: 8 },
  footer: { gap: 8, paddingTop: 8 },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 16 },
})
