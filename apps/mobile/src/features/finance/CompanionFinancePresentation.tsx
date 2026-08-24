import { StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { SettingsRow } from '@/design-system/molecules/SettingsRow'
import { Screen } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export type CompanionFinanceObligationItem = {
  id: string
  amountLabel: string
  detail: string
  feeLabel: string
  pastDue: boolean
}

export type CompanionFinanceLedgerItem = {
  id: string
  label: string
  detail: string
  value: string
}

export function CompanionFinancePresentation({
  canAcceptBookings,
  availableEarnings,
  pendingEarnings,
  platformFeeBalance,
  dueThisSaturday,
  dueDateLabel,
  pastDue,
  hasPastDue,
  payoutNotice,
  obligations,
  ledger,
  onBack,
}: {
  canAcceptBookings: boolean
  availableEarnings: string
  pendingEarnings: string
  platformFeeBalance: string
  dueThisSaturday: string
  dueDateLabel: string
  pastDue: string
  hasPastDue: boolean
  payoutNotice: string
  obligations: readonly CompanionFinanceObligationItem[]
  ledger: readonly CompanionFinanceLedgerItem[]
  onBack: () => void
}) {
  const theme = useAppTheme()

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        title="Companion finance"
        subtitle="Read-only balances"
        back
        onBack={onBack}
      />

      <View
        accessibilityRole={canAcceptBookings ? 'text' : 'alert'}
        style={[
          styles.status,
          {
            borderColor: canAcceptBookings
              ? theme.colors.selfText
              : theme.colors.danger,
          },
        ]}>
        <AppText
          variant="bodyStrong"
          color={canAcceptBookings ? theme.colors.selfText : theme.colors.danger}>
          {canAcceptBookings
            ? 'Eligible to accept bookings'
            : 'Booking acceptance paused'}
        </AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          {canAcceptBookings
            ? 'No past-due platform fee obligation is recorded.'
            : 'Resolve past-due platform fees before accepting another booking.'}
        </AppText>
      </View>

      <FinanceGroup title="Earnings">
        <SettingsRow
          label="Available earnings"
          detail="Internal earnings balance currently available"
          value={availableEarnings}
        />
        <SettingsRow
          label="Pending earnings"
          detail="Waiting for the booking to settle"
          value={pendingEarnings}
        />
      </FinanceGroup>

      <FinanceGroup title="Platform fees">
        <SettingsRow
          label="Platform fee balance"
          detail="Credits less recorded fee payments"
          value={platformFeeBalance}
        />
        <SettingsRow
          label="Due this Saturday"
          detail={dueDateLabel}
          value={dueThisSaturday}
        />
        <SettingsRow
          label="Past due"
          detail="Outstanding obligations after their due date"
          value={pastDue}
          danger={hasPastDue}
        />
      </FinanceGroup>

      <View style={[styles.notice, { borderTopColor: theme.colors.border }]}>
        <AppText variant="bodyStrong">Payout status</AppText>
        <AppText color={theme.colors.textMuted}>{payoutNotice}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          This screen cannot initiate payouts, alter balances, or mark obligations paid.
        </AppText>
      </View>

      <FinanceGroup title={`Open obligations (${obligations.length})`}>
        {obligations.length ? obligations.map((obligation) => (
          <SettingsRow
            key={obligation.id}
            label={obligation.amountLabel}
            detail={obligation.detail}
            value={obligation.feeLabel}
            danger={obligation.pastDue}
          />
        )) : <EmptyRow text="No open platform fee obligations." />}
      </FinanceGroup>

      <FinanceGroup title={`Ledger (${ledger.length})`}>
        {ledger.length ? ledger.map((entry) => (
          <SettingsRow
            key={entry.id}
            label={entry.label}
            detail={entry.detail}
            value={entry.value}
          />
        )) : <EmptyRow text="No platform fee ledger entries." />}
      </FinanceGroup>
    </Screen>
  )
}

function FinanceGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const theme = useAppTheme()
  return (
    <View style={styles.group}>
      <AppText variant="label" color={theme.colors.selfText}>
        {title.toUpperCase()}
      </AppText>
      <View>{children}</View>
    </View>
  )
}

function EmptyRow({ text }: { text: string }) {
  const theme = useAppTheme()
  return (
    <View style={styles.emptyRow}>
      <AppText variant="caption" color={theme.colors.textMuted}>{text}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: density.screenBottom,
    gap: density.contentGap,
  },
  status: {
    borderLeftWidth: 3,
    paddingVertical: density.cardGap,
    paddingHorizontal: density.cardPadding,
    gap: density.textStackGap,
  },
  group: { gap: density.textSectionGap },
  notice: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: density.contentGap,
    gap: density.textStackGap,
  },
  emptyRow: {
    minHeight: density.controlHeight + 4,
    justifyContent: 'center',
    paddingVertical: density.cardGap,
  },
})
