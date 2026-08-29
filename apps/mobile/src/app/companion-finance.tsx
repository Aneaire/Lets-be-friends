import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { StyleSheet } from 'react-native'

import { mobileApi } from '@/backend/client'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import {
  CompanionFinancePresentation,
  type CompanionFinanceLedgerItem,
  type CompanionFinanceObligationItem,
} from '@/features/finance/CompanionFinancePresentation'
import { useMobileMember } from '@/member/MobileMember'

type Dashboard = NonNullable<FunctionReturnType<typeof mobileApi.finance.dashboard>>

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

  if (dashboard === undefined) return <PageSkeleton variant="finance" />
  if (dashboard === null) return <FinanceState title="No Companion finance profile" detail="Create a Companion profile before finance balances and obligations are available." action="Open Companion tools" onPress={() => router.replace('/companion')} />

  return (
    <CompanionFinancePresentation
      canAcceptBookings={dashboard.canAcceptBookings}
      availableEarnings={formatMoney(dashboard.availableEarningsCentavos)}
      pendingEarnings={formatMoney(dashboard.pendingEarningsCentavos)}
      platformFeeBalance={formatMoney(dashboard.availableBalanceCentavos)}
      dueThisSaturday={formatMoney(dashboard.dueThisSaturdayCentavos)}
      dueDateLabel={formatDate(dashboard.dueAt)}
      pastDue={formatMoney(dashboard.pastDueCentavos)}
      hasPastDue={dashboard.pastDueCentavos > 0}
      payoutNotice={dashboard.payoutNotice}
      obligations={dashboard.obligations.map(companionFinanceObligation)}
      ledger={dashboard.ledger.map(companionFinanceLedgerEntry)}
      onBack={goBackOrProfile}
    />
  )
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
  state: { paddingHorizontal: 16 },
})
