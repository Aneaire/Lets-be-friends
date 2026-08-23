import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { Screen } from '@/design-system/templates/Screen'
import { SettingsRow } from '@/design-system/molecules/SettingsRow'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type Dashboard = NonNullable<FunctionReturnType<typeof mobileApi.finance.dashboard>>
type Obligation = Dashboard['obligations'][number]
type LedgerEntry = Dashboard['ledger'][number]

export default function CompanionFinanceScreen() {
  const member = useMobileMember()

  if (member.status === 'signed_out') return <FinanceState title="Sign in to view Companion finance" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <FinanceState title="Companion finance needs account services" detail="Connect your account to load earnings and obligations." />
  if (member.status === 'unavailable' || member.status === 'error') return <FinanceState title="Companion finance is unavailable" detail={member.message} />
  if (member.status !== 'ready') return <FinanceState title="Loading Companion finance" loading />
  return <ReadyCompanionFinance />
}

function ReadyCompanionFinance() {
  const theme = useAppTheme()
  const dashboard = useQuery(mobileApi.finance.dashboard, {})

  if (dashboard === undefined) return <FinanceState title="Loading Companion finance" detail="Retrieving your verified earnings activity." loading />
  if (dashboard === null) return <FinanceState title="No Companion finance profile" detail="Create a Companion profile before finance balances and obligations are available." action="Open Companion tools" onPress={() => router.replace('/companion')} />

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Companion finance" subtitle="Read-only balances" back onBack={goBackOrProfile} />

      <View style={[styles.status, { backgroundColor: dashboard.canAcceptBookings ? theme.colors.selfSoft : theme.colors.surfaceRaised, borderColor: dashboard.canAcceptBookings ? theme.colors.self : theme.colors.danger }]}>
        <AppText variant="bodyStrong" color={dashboard.canAcceptBookings ? theme.colors.self : theme.colors.danger}>{dashboard.canAcceptBookings ? 'Eligible to accept bookings' : 'Booking acceptance paused'}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{dashboard.canAcceptBookings ? 'No past-due platform fee obligation is recorded.' : 'Resolve past-due platform fees before accepting another booking.'}</AppText>
      </View>

      <FinanceGroup title="Earnings">
        <SettingsRow label="Available earnings" detail="Internal earnings balance currently available" value={formatMoney(dashboard.availableEarningsCentavos)} />
        <SettingsRow label="Pending earnings" detail="Waiting for the booking to settle" value={formatMoney(dashboard.pendingEarningsCentavos)} />
      </FinanceGroup>

      <FinanceGroup title="Platform fees">
        <SettingsRow label="Platform fee balance" detail="Credits less recorded fee payments" value={formatMoney(dashboard.availableBalanceCentavos)} />
        <SettingsRow label="Due this Saturday" detail={formatDate(dashboard.dueAt)} value={formatMoney(dashboard.dueThisSaturdayCentavos)} />
        <SettingsRow label="Past due" detail="Outstanding obligations after their due date" value={formatMoney(dashboard.pastDueCentavos)} danger={dashboard.pastDueCentavos > 0} />
      </FinanceGroup>

      <View style={[styles.notice, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
        <AppText variant="bodyStrong">Payout status</AppText>
        <AppText color={theme.colors.textMuted}>{dashboard.payoutNotice}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>This screen cannot initiate payouts, alter balances, or mark obligations paid.</AppText>
      </View>

      <FinanceGroup title={`Open obligations (${dashboard.obligations.length})`}>
        {dashboard.obligations.length ? dashboard.obligations.map((obligation) => <ObligationRow key={String(obligation._id)} obligation={obligation} />) : <EmptyRow text="No open platform fee obligations." />}
      </FinanceGroup>

      <FinanceGroup title={`Ledger (${dashboard.ledger.length})`}>
        {dashboard.ledger.length ? dashboard.ledger.map((entry) => <LedgerRow key={String(entry._id)} entry={entry} />) : <EmptyRow text="No platform fee ledger entries." />}
      </FinanceGroup>
    </Screen>
  )
}

function FinanceGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useAppTheme()
  return <View style={styles.group}><AppText variant="label" color={theme.colors.self}>{title.toUpperCase()}</AppText><View style={[styles.rows, { borderColor: theme.colors.border }]}>{children}</View></View>
}

function ObligationRow({ obligation }: { obligation: Obligation }) {
  return <SettingsRow label={formatMoney(obligation.remainingCentavos)} detail={`Due ${formatDate(obligation.dueAt)} · ${formatMoney(obligation.paidCentavos)} paid`} value={`${Math.round(obligation.commissionBps / 100)}% fee`} danger={obligation.dueAt <= Date.now()} />
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  return <SettingsRow label={humanize(entry.kind)} detail={formatDateTime(entry.createdAt)} value={`${entry.direction === 'credit' ? '+' : '-'}${formatMoney(entry.amountCentavos)}`} />
}

function EmptyRow({ text }: { text: string }) {
  const theme = useAppTheme()
  return <View style={styles.emptyRow}><AppText variant="caption" color={theme.colors.textMuted}>{text}</AppText></View>
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
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  state: { paddingHorizontal: 16 },
  status: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  group: { gap: 7 },
  rows: { borderTopWidth: 1, borderBottomWidth: 1 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  emptyRow: { minHeight: 56, justifyContent: 'center', paddingVertical: 10 },
})
