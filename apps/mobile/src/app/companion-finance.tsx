import type { FunctionReturnType } from 'convex/server'
import { useAction, useMutation, useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { StateView } from '@/design-system/molecules/StateView'
import { BottomSheet } from '@/design-system/molecules/BottomSheet'
import { ConfirmationDialog } from '@/design-system/molecules/ConfirmationDialog'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import {
  CompanionFinancePresentation,
  type CompanionFinanceLedgerItem,
  type CompanionFinanceObligationItem,
  type CompanionWithdrawalItem,
} from '@/features/finance/CompanionFinancePresentation'
import { parseWithdrawalAmount, withdrawalStatusPresentation } from '@/data/withdrawals'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

type Dashboard = NonNullable<FunctionReturnType<typeof mobileApi.finance.dashboard>>
type PayoutDashboard = NonNullable<FunctionReturnType<typeof mobileApi.withdrawals.dashboard>>
type Institution = { bic: string; name: string }

export default function CompanionFinanceScreen() {
  const member = useMobileMember()

  if (member.status === 'signed_out') return <FinanceState title="Sign in to view Companion finance" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <FinanceState title="Companion finance needs account services" detail="Connect your account to load earnings and obligations." />
  if (member.status === 'unavailable' || member.status === 'error') return <FinanceState title="Companion finance is unavailable" detail={member.message} />
  if (member.status !== 'ready') return <PageSkeleton variant="finance" />
  return <ReadyCompanionFinance />
}

function ReadyCompanionFinance() {
  const dashboard = useQuery(mobileApi.finance.dashboard, {})
  const payouts = useQuery(mobileApi.withdrawals.dashboard, {})
  const listReceivingInstitutions = useAction(mobileApi.withdrawals.listReceivingInstitutions)
  const savePayoutMethod = useAction(mobileApi.withdrawals.savePayoutMethod)
  const requestWithdrawal = useMutation(mobileApi.withdrawals.request)
  const theme = useAppTheme()
  const [withdrawalAmount, setWithdrawalAmount] = useState('1000')
  const [pendingWithdrawal, setPendingWithdrawal] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [setupVisible, setSetupVisible] = useState(false)
  const [setup, setSetup] = useState<{ accountName: string; institutions: Institution[] } | null>(null)
  const [institutionSearch, setInstitutionSearch] = useState('')
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null)
  const [accountNumber, setAccountNumber] = useState('')
  const [accountNumberConfirmation, setAccountNumberConfirmation] = useState('')
  const filteredInstitutions = useMemo(() => {
    const search = institutionSearch.trim().toLocaleLowerCase()
    return (setup?.institutions ?? []).filter((institution) => !search || institution.name.toLocaleLowerCase().includes(search)).slice(0, 50)
  }, [institutionSearch, setup])

  if (dashboard === undefined || payouts === undefined) return <PageSkeleton variant="finance" />
  if (dashboard === null) return <FinanceState title="No Companion finance profile" detail="Create a Companion profile before finance balances and obligations are available." action="Open Companion tools" onPress={() => router.replace('/companion')} />
  if (payouts === null) return <FinanceState title="Companion withdrawals are unavailable" detail="A Companion finance profile is required before payout settings can be loaded." />

  return (
    <View style={styles.container}>
      <CompanionFinancePresentation
        canAcceptBookings={dashboard.canAcceptBookings}
        availableEarnings={formatMoney(dashboard.availableEarningsCentavos)}
        inTransferEarnings={formatMoney(dashboard.inTransferEarningsCentavos)}
        pendingEarnings={formatMoney(dashboard.pendingEarningsCentavos)}
        platformFeeBalance={formatMoney(dashboard.availableBalanceCentavos)}
        dueThisSaturday={formatMoney(dashboard.dueThisSaturdayCentavos)}
        dueDateLabel={formatDate(dashboard.dueAt)}
        pastDue={formatMoney(dashboard.pastDueCentavos)}
        hasPastDue={dashboard.pastDueCentavos > 0}
        payoutNotice={dashboard.payoutNotice}
        withdrawalsEnabled={payouts.enabled}
        payoutMethod={payoutMethodItem(payouts)}
        activeWithdrawal={payouts.activeWithdrawalId !== null}
        withdrawalAmount={withdrawalAmount}
        withdrawalMessage={message}
        withdrawalBusy={busy}
        withdrawals={payouts.withdrawals.map(companionWithdrawalItem)}
        onWithdrawalAmountChange={(value) => { setWithdrawalAmount(value); setMessage('') }}
        onReviewWithdrawal={() => {
          const parsed = parseWithdrawalAmount(withdrawalAmount, payouts.availableEarningsCentavos)
          if (!parsed.ok) {
            setMessage(`Error: ${parsed.message}`)
            return
          }
          setMessage('')
          setPendingWithdrawal(parsed.amountCentavos)
        }}
        onSetupPayoutMethod={() => { void openPayoutSetup() }}
        obligations={dashboard.obligations.map(companionFinanceObligation)}
        ledger={dashboard.ledger.map(companionFinanceLedgerEntry)}
        onBack={goBackOrProfile}
      />

      <BottomSheet
        visible={setupVisible}
        title={payouts.payoutMethod ? 'Replace payout method' : 'Set up payout method'}
        description="Use a bank or e-wallet account under your verified legal name. Saving starts a 24-hour security hold."
        busy={busy}
        onClose={closePayoutSetup}
        footer={(
          <View style={styles.sheetActions}>
            <ActionButton label="Save payout method" intent="self" loading={busy} disabled={!selectedInstitution || !accountNumber || !accountNumberConfirmation} onPress={() => { void saveSetup() }} />
            <ActionButton label="Cancel" intent="neutral" secondary disabled={busy} onPress={closePayoutSetup} />
          </View>
        )}>
        <View style={styles.setupContent}>
          {message.startsWith('Error:') ? <AppText color={theme.colors.danger}>{message.replace(/^Error:\s*/, '')}</AppText> : null}
          {!selectedInstitution ? (
            <>
              <AppText variant="caption" color={theme.colors.textMuted}>Search PayMongo’s current InstaPay institutions</AppText>
              <TextField value={institutionSearch} onChangeText={setInstitutionSearch} placeholder="Bank or e-wallet" accessibilityLabel="Search banks and e-wallets" />
              <View>
                {filteredInstitutions.map((institution) => (
                  <Pressable
                    key={institution.bic}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${institution.name}`}
                    onPress={() => setSelectedInstitution(institution)}
                    style={({ pressed }) => [styles.institutionRow, { borderBottomColor: theme.colors.border }, pressed && styles.pressed]}>
                    <AppText variant="bodyStrong" style={styles.institutionName}>{institution.name}</AppText>
                    <AppText variant="caption" color={theme.colors.textMuted}>{institution.bic}</AppText>
                  </Pressable>
                ))}
                {setup && filteredInstitutions.length === 0 ? <AppText variant="caption" color={theme.colors.textMuted}>No supported institution matches that search.</AppText> : null}
              </View>
            </>
          ) : (
            <>
              <View style={[styles.selectedInstitution, { borderColor: theme.colors.border }]}>
                <View style={styles.institutionName}><AppText variant="bodyStrong">{selectedInstitution.name}</AppText><AppText variant="caption" color={theme.colors.textMuted}>{selectedInstitution.bic}</AppText></View>
                <ActionButton label="Change" intent="self" secondary compact disabled={busy} onPress={() => setSelectedInstitution(null)} />
              </View>
              <AppText variant="caption" color={theme.colors.textMuted}>Verified account holder</AppText>
              <View style={[styles.readOnlyField, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                <AppText>{setup?.accountName}</AppText>
              </View>
              <AppText variant="caption" color={theme.colors.textMuted}>Account number</AppText>
              <TextField value={accountNumber} onChangeText={(value) => { setAccountNumber(value); setMessage('') }} keyboardType="number-pad" inputMode="numeric" autoComplete="off" accessibilityLabel="Payout account number" />
              <AppText variant="caption" color={theme.colors.textMuted}>Confirm account number</AppText>
              <TextField value={accountNumberConfirmation} onChangeText={(value) => { setAccountNumberConfirmation(value); setMessage('') }} keyboardType="number-pad" inputMode="numeric" autoComplete="off" accessibilityLabel="Confirm payout account number" />
            </>
          )}
        </View>
      </BottomSheet>

      <ConfirmationDialog
        visible={pendingWithdrawal !== null}
        title={pendingWithdrawal === null ? 'Confirm withdrawal' : `Confirm ${formatMoney(pendingWithdrawal)} withdrawal`}
        description={payouts.payoutMethod ? `To ${payouts.payoutMethod.institutionName}, account ending in ${payouts.payoutMethod.accountNumberLast4}.` : 'Confirm the withdrawal destination.'}
        confirmLabel="Confirm withdrawal"
        busyLabel="Submitting"
        intent="self"
        busy={busy}
        onClose={() => setPendingWithdrawal(null)}
        onConfirm={confirmWithdrawal}>
        <View style={styles.confirmationCopy}>
          <AppText>You receive: <AppText variant="bodyStrong">{pendingWithdrawal === null ? '' : formatMoney(pendingWithdrawal)}</AppText></AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>The platform pays the transfer fee. InstaPay usually arrives within minutes, but final status can take up to 20 minutes. Submitted transfers cannot be cancelled.</AppText>
        </View>
      </ConfirmationDialog>
    </View>
  )

  async function openPayoutSetup() {
    setBusy(true)
    setMessage('')
    try {
      const result = await listReceivingInstitutions({})
      setSetup(result)
      setInstitutionSearch('')
      setSelectedInstitution(null)
      setAccountNumber('')
      setAccountNumberConfirmation('')
      setSetupVisible(true)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Supported institutions could not be loaded.'}`)
    } finally {
      setBusy(false)
    }
  }

  function closePayoutSetup() {
    if (busy) return
    setSetupVisible(false)
    setSelectedInstitution(null)
    setMessage('')
  }

  async function saveSetup() {
    if (!selectedInstitution) return
    if (accountNumber.replace(/[\s-]/g, '') !== accountNumberConfirmation.replace(/[\s-]/g, '')) {
      setMessage('Error: Account numbers do not match.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const result = await savePayoutMethod({ institutionBic: selectedInstitution.bic, accountNumber })
      setSetupVisible(false)
      setMessage(`${result.institutionName} ending in ${result.accountNumberLast4} was saved. Withdrawals unlock after the 24-hour security hold.`)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Payout method could not be saved.'}`)
    } finally {
      setBusy(false)
    }
  }

  async function confirmWithdrawal() {
    if (pendingWithdrawal === null) return
    setBusy(true)
    setMessage('')
    try {
      await requestWithdrawal({ amountCentavos: pendingWithdrawal })
      setMessage(`${formatMoney(pendingWithdrawal)} is now in transfer. Track its final status below.`)
      setPendingWithdrawal(null)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Withdrawal could not be requested.'}`)
      setPendingWithdrawal(null)
    } finally {
      setBusy(false)
    }
  }
}

function payoutMethodItem(payouts: PayoutDashboard) {
  if (!payouts.payoutMethod) return null
  return {
    institutionName: payouts.payoutMethod.institutionName,
    accountName: payouts.payoutMethod.accountName,
    accountNumberLast4: payouts.payoutMethod.accountNumberLast4,
    ready: payouts.payoutMethod.ready,
    modeMismatch: payouts.payoutMethod.modeMismatch,
    readyLabel: payouts.payoutMethod.modeMismatch
      ? 'Replace this payout method for the current PayMongo mode.'
      : `Ready ${formatDateTime(payouts.payoutMethod.availableAt)}. This hold protects account changes.`,
  }
}

function companionWithdrawalItem(withdrawal: PayoutDashboard['withdrawals'][number]): CompanionWithdrawalItem {
  const status = withdrawalStatusPresentation(withdrawal.status)
  return {
    id: String(withdrawal.id),
    amountLabel: formatMoney(withdrawal.amountCentavos),
    destinationLabel: `${withdrawal.institutionName} · •••• ${withdrawal.accountNumberLast4}`,
    dateLabel: formatDateTime(withdrawal.createdAt),
    statusLabel: status.label,
    detail: status.detail,
    danger: status.danger,
  }
}

function companionFinanceObligation(
  obligation: Dashboard['obligations'][number],
): CompanionFinanceObligationItem {
  return {
    id: String(obligation._id),
    amountLabel: formatMoney(obligation.remainingCentavos),
    detail: `Due ${formatDate(obligation.dueAt)} · ${formatMoney(obligation.paidCentavos)} paid`,
    feeLabel: `${Math.round(obligation.commissionBps / 100)}% fee`,
    pastDue: obligation.dueAt <= Date.now(),
  }
}

function companionFinanceLedgerEntry(
  entry: Dashboard['ledger'][number],
): CompanionFinanceLedgerItem {
  return {
    id: String(entry._id),
    label: humanize(entry.kind),
    detail: formatDateTime(entry.createdAt),
    value: `${entry.direction === 'credit' ? '+' : '-'}${formatMoney(entry.amountCentavos)}`,
  }
}

function FinanceState({ title, detail, action, onPress, loading = false }: { title: string; detail?: string; action?: string; onPress?: () => void; loading?: boolean }) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="COMPANION FINANCE" title={title} detail={detail} actionLabel={action} onAction={onPress} loading={loading} intent="self" /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <FinanceState title="Companion finance is temporarily unavailable" detail="No balance or obligation was changed." action="Try again" onPress={retry} />
}

function formatMoney(centavos: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(centavos / 100)
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(timestamp))
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(timestamp))
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
}

function goBackOrProfile() {
  if (router.canGoBack()) router.back()
  else router.replace('/profile')
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  state: { paddingHorizontal: 16 },
  setupContent: { gap: density.cardGap },
  sheetActions: { gap: density.cardGap },
  institutionRow: { minHeight: density.controlHeight, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: density.cardGap, paddingVertical: density.cardGap },
  institutionName: { flex: 1, minWidth: 0 },
  selectedInstitution: { borderWidth: StyleSheet.hairlineWidth, borderRadius: density.controlRadius, padding: density.cardPadding, flexDirection: 'row', alignItems: 'center', gap: density.cardGap },
  readOnlyField: { minHeight: density.controlHeight, borderWidth: 1, borderRadius: density.controlRadius, paddingHorizontal: density.compactCardPadding, justifyContent: 'center' },
  confirmationCopy: { gap: density.cardGap },
  pressed: { opacity: 0.68 },
})
