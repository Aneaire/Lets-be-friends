import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { TextField } from '@/design-system/atoms/Field'
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

export type CompanionPayoutMethodItem = {
  institutionName: string
  accountName: string
  accountNumberLast4: string
  ready: boolean
  readyLabel?: string
  modeMismatch?: boolean
}

export type CompanionWithdrawalItem = {
  id: string
  amountLabel: string
  destinationLabel: string
  dateLabel: string
  statusLabel: string
  detail: string
  danger: boolean
}

export function CompanionFinancePresentation({
  canAcceptBookings,
  availableEarnings,
  inTransferEarnings = '₱0.00',
  pendingEarnings,
  platformFeeBalance,
  dueThisSaturday,
  dueDateLabel,
  pastDue,
  hasPastDue,
  payoutNotice,
  withdrawalsEnabled = false,
  payoutMethod,
  activeWithdrawal = false,
  withdrawalAmount = '',
  withdrawalMessage = '',
  withdrawalBusy = false,
  withdrawals = [],
  onWithdrawalAmountChange,
  onReviewWithdrawal,
  onSetupPayoutMethod,
  obligations,
  ledger,
  onBack,
}: {
  canAcceptBookings: boolean
  availableEarnings: string
  inTransferEarnings?: string
  pendingEarnings: string
  platformFeeBalance: string
  dueThisSaturday: string
  dueDateLabel: string
  pastDue: string
  hasPastDue: boolean
  payoutNotice: string
  withdrawalsEnabled?: boolean
  payoutMethod?: CompanionPayoutMethodItem | null
  activeWithdrawal?: boolean
  withdrawalAmount?: string
  withdrawalMessage?: string
  withdrawalBusy?: boolean
  withdrawals?: readonly CompanionWithdrawalItem[]
  onWithdrawalAmountChange?: (value: string) => void
  onReviewWithdrawal?: () => void
  onSetupPayoutMethod?: () => void
  obligations: readonly CompanionFinanceObligationItem[]
  ledger: readonly CompanionFinanceLedgerItem[]
  onBack: () => void
}) {
  const theme = useAppTheme()

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        title="Withdraw earnings"
        subtitle="Companion earnings"
        back
        onBack={onBack}
      />

      {!canAcceptBookings ? (
        <View
          accessibilityRole="alert"
          style={[styles.status, { borderColor: theme.colors.danger, backgroundColor: theme.colors.surface }]}>
          <AppText variant="bodyStrong" color={theme.colors.danger}>Booking acceptance paused</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Resolve past-due platform fees before accepting another booking.
          </AppText>
        </View>
      ) : null}

      <View style={[styles.balanceCard, { borderColor: theme.colors.border, borderLeftColor: theme.colors.selfText, backgroundColor: theme.colors.surface }]}>
        <AppText variant="label" color={theme.colors.textMuted}>AVAILABLE TO WITHDRAW</AppText>
        <AppText variant="title" style={styles.balanceValue}>{availableEarnings}</AppText>
        <View style={[styles.balanceBreakdown, { borderTopColor: theme.colors.border }]}>
          <BalanceStat label="In transfer" value={inTransferEarnings} />
          <View style={[styles.balanceDivider, { backgroundColor: theme.colors.border }]} />
          <BalanceStat label="Pending" value={pendingEarnings} />
        </View>
      </View>

      <View style={[styles.withdrawalCard, { borderColor: theme.colors.border }]}>
        <View style={styles.withdrawalHeading}>
          <View style={styles.withdrawalHeadingCopy}>
            <AppText variant="heading">Make a withdrawal</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>Transfer available earnings to your payout account.</AppText>
          </View>
        </View>

        {!withdrawalsEnabled ? (
          <AppText color={theme.colors.textMuted}>{payoutNotice}</AppText>
        ) : payoutMethod ? (
          <View style={[styles.destinationRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <View style={styles.destinationCopy}>
              <AppText variant="label" color={theme.colors.textMuted}>PAYOUT ACCOUNT</AppText>
              <AppText variant="bodyStrong">{payoutMethod.institutionName} · •••• {payoutMethod.accountNumberLast4}</AppText>
              {!payoutMethod.ready && payoutMethod.readyLabel ? (
                <AppText variant="caption" color={payoutMethod.modeMismatch ? theme.colors.danger : theme.colors.textMuted}>{payoutMethod.readyLabel}</AppText>
              ) : null}
            </View>
            <ActionButton
              label="Change"
              accessibilityHint="Replace your payout method"
              intent="self"
              secondary
              compact
              disabled={withdrawalBusy || activeWithdrawal}
              style={styles.changeButton}
              onPress={() => onSetupPayoutMethod?.()}
            />
          </View>
        ) : (
          <View style={styles.emptyPayoutMethod}>
            <AppText variant="bodyStrong">Add a payout account first</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>The account must use your verified legal name.</AppText>
            <ActionButton label="Set up payout method" intent="self" disabled={withdrawalBusy} onPress={() => onSetupPayoutMethod?.()} />
          </View>
        )}

        {withdrawalsEnabled && payoutMethod?.ready && !payoutMethod.modeMismatch && !activeWithdrawal ? (
          <View style={styles.withdrawalForm}>
            <AppText variant="caption" color={theme.colors.textMuted}>Amount in PHP</AppText>
            <TextField
              value={withdrawalAmount}
              onChangeText={onWithdrawalAmountChange}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="1000"
              editable={!withdrawalBusy}
              accessibilityLabel="Withdrawal amount in Philippine pesos"
            />
            <ActionButton label="Review withdrawal" intent="self" loading={withdrawalBusy} onPress={() => onReviewWithdrawal?.()} />
          </View>
        ) : null}
        {activeWithdrawal ? (
          <View style={[styles.activeWithdrawal, { backgroundColor: theme.colors.selfSoft }]}>
            <AppIcon name="time-outline" size={18} color={theme.colors.selfText} />
            <AppText variant="caption" color={theme.colors.selfText}>A withdrawal is in transfer. You can start another after it finishes.</AppText>
          </View>
        ) : null}
        {withdrawalMessage ? <AppText color={withdrawalMessage.startsWith('Error:') ? theme.colors.danger : theme.colors.selfText}>{withdrawalMessage.replace(/^Error:\s*/, '')}</AppText> : null}

        {withdrawalsEnabled ? (
          <DisclosureSection
            compact
            title="How withdrawals work"
            summary="Timing, fees, and account holds">
            <AppText variant="caption" color={theme.colors.textMuted}>{payoutNotice}</AppText>
          </DisclosureSection>
        ) : null}
      </View>

      {withdrawalsEnabled && withdrawals.length ? (
        <DisclosureSection
          title="Withdrawal history"
          summary={`${withdrawals.length} ${withdrawals.length === 1 ? 'withdrawal' : 'withdrawals'}`}>
          {withdrawals.map((withdrawal) => (
            <SettingsRow
              key={withdrawal.id}
              label={withdrawal.amountLabel}
              detail={`${withdrawal.destinationLabel} · ${withdrawal.dateLabel}\n${withdrawal.detail}`}
              value={withdrawal.statusLabel}
              danger={withdrawal.danger}
            />
          ))}
        </DisclosureSection>
      ) : null}

      <DisclosureSection
        title="Legacy platform fees"
        summary={hasPastDue ? `${pastDue} past due` : `${dueThisSaturday} due ${dueDateLabel}`}
        initiallyExpanded={hasPastDue}>
        <FinanceGroup title="Balance">
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
      </DisclosureSection>
    </Screen>
  )
}

function BalanceStat({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme()
  return (
    <View style={styles.balanceStat}>
      <AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  )
}

function DisclosureSection({
  title,
  summary,
  children,
  compact = false,
  initiallyExpanded = false,
}: {
  title: string
  summary: string
  children: React.ReactNode
  compact?: boolean
  initiallyExpanded?: boolean
}) {
  const theme = useAppTheme()
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const action = expanded ? 'Hide' : 'Show'

  return (
    <View style={[
      styles.disclosure,
      compact && styles.compactDisclosure,
      { borderColor: theme.colors.border, backgroundColor: compact ? theme.colors.background : theme.colors.surfaceRaised },
    ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${action} ${title.toLowerCase()}`}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.disclosureButton, compact && styles.compactDisclosureButton, pressed && styles.pressed]}>
        <View style={styles.disclosureCopy}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>{summary}</AppText>
        </View>
        <AppText variant="label" color={theme.colors.selfText}>{action}</AppText>
        <AppIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.selfText} />
      </Pressable>
      {expanded ? (
        <View style={[styles.disclosureBody, { borderTopColor: theme.colors.border }]}>{children}</View>
      ) : null}
    </View>
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
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderRadius: density.controlRadius,
    paddingVertical: density.cardGap,
    paddingHorizontal: density.cardPadding,
    gap: density.textStackGap,
  },
  balanceCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderRadius: density.controlRadius,
    padding: density.cardPadding,
    gap: density.textStackGap,
  },
  balanceValue: { marginTop: 2 },
  balanceBreakdown: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: density.cardGap,
    paddingTop: density.cardGap,
  },
  balanceStat: { flex: 1, minWidth: 0, gap: density.textPairGap },
  balanceDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: density.cardPadding },
  withdrawalCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: density.controlRadius,
    padding: density.cardPadding,
    gap: density.cardPadding,
  },
  withdrawalHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: density.cardGap },
  withdrawalHeadingCopy: { flex: 1, minWidth: 0, gap: density.textPairGap },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: density.cardGap,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: density.controlRadius,
    padding: density.compactCardPadding,
  },
  destinationCopy: { flex: 1, minWidth: 0, gap: density.textPairGap },
  changeButton: { flexShrink: 0 },
  emptyPayoutMethod: { gap: density.cardGap },
  activeWithdrawal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: density.controlRadius,
    padding: density.compactCardPadding,
    gap: density.cardGap,
  },
  group: { gap: density.textSectionGap },
  disclosure: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: density.controlRadius,
  },
  compactDisclosure: { borderLeftWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderRadius: 0 },
  disclosureButton: { minHeight: density.controlHeight + 8, flexDirection: 'row', alignItems: 'center', gap: density.cardGap, padding: density.cardPadding },
  compactDisclosureButton: { paddingHorizontal: 0, paddingBottom: 0 },
  disclosureCopy: { flex: 1, minWidth: 0, gap: density.textPairGap },
  disclosureBody: { borderTopWidth: StyleSheet.hairlineWidth, padding: density.cardPadding, gap: density.contentGap },
  withdrawalForm: { gap: density.cardGap },
  emptyRow: {
    minHeight: density.controlHeight + 4,
    justifyContent: 'center',
    paddingVertical: density.cardGap,
  },
  pressed: { opacity: 0.68 },
})
