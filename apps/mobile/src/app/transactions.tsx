import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { StyleSheet } from 'react-native'

import { mobileApi } from '@/backend/client'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { TransactionsPresentation } from '@/features/finance/TransactionsPresentation'
import { transactionsActivityState, transactionsBookingQueryArgs, transactionsTopUpQueryArgs } from '@/features/finance/transactions'
import { useMobileMember } from '@/member/MobileMember'

export default function TransactionsScreen() {
  const member = useMobileMember()
  const bookingTransactions = useQuery(
    mobileApi.finance.memberBookingTransactions,
    transactionsBookingQueryArgs(member.status),
  )
  const topUps = useQuery(
    mobileApi.finance.memberTopUps,
    transactionsTopUpQueryArgs(member.status),
  )

  if (member.status === 'signed_out') return <TransactionsState title="Sign in to view your transactions" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <TransactionsState title="Transactions need account services" detail="Connect your account to view wallet activity." />
  if (member.status === 'unavailable' || member.status === 'error') return <TransactionsState title="Transactions are unavailable" detail={member.message} />
  if (member.status !== 'ready') return <PageSkeleton variant="wallet" />

  return (
    <ReadyTransactionsView
      bookingTransactions={bookingTransactions}
      topUps={topUps}
    />
  )
}

function TransactionsState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  return (
    <Screen scroll={false} contentStyle={styles.state}>
      <StateView eyebrow="TRANSACTIONS" title={title} detail={detail} actionLabel={action} onAction={onPress} intent="self" />
    </Screen>
  )
}

type ReadyTransactionsProps = {
  bookingTransactions: FunctionReturnType<typeof mobileApi.finance.memberBookingTransactions> | undefined
  topUps: FunctionReturnType<typeof mobileApi.finance.memberTopUps> | undefined
}

export function ReadyTransactionsView({ bookingTransactions, topUps }: ReadyTransactionsProps) {
  const activity = transactionsActivityState({ bookingTransactions, topUps })
  return (
    <TransactionsPresentation
      rows={activity.state === 'ready' ? activity.rows : undefined}
      onBack={() => router.replace('/bookings' as never)}
      onOpenBooking={(bookingId) => router.push(`/booking/${bookingId}` as never)}
    />
  )
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <TransactionsState title="Transactions are temporarily unavailable" detail="Reload and try again. No wallet balance was changed." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  state: { paddingHorizontal: 16 },
})
