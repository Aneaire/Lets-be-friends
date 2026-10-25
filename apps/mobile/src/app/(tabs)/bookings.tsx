import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { BookingCard } from '@/design-system/organisms/BookingCard'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { SegmentedControl } from '@/design-system/molecules/SegmentedControl'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { EmptyState } from '@/design-system/molecules/FeedbackState'
import { BookingsCalendarView } from '@/features/booking/BookingsCalendarView'
import { BOOKINGS_WALLET_ROUTE, BookingsHeader, bookingsWalletQueryArgs, type BookingsWallet } from '@/features/booking/BookingsHeader'
import { TRANSACTIONS_ROUTE } from '@/features/finance/transactions'
import { WalletActivityList } from '@/features/finance/WalletActivityList'
import { bookingActivityRow } from '@/data/walletActivity'
import type { BookingsViewMode } from '@/data/bookingCalendar'
import { useMobileMember } from '@/member/MobileMember'
import {
  bookingDetailRoute,
  calendarParticipantName,
  combineCalendarBookings,
  filterMemberBookings,
  type CombinedCalendarBooking,
  type MemberBookingFilter,
} from '@/member/combinedBookings'
import { useAppTheme } from '@/theme/ThemeProvider'

type MemberBooking = FunctionReturnType<typeof mobileApi.bookings.mine>[number]
type CompanionBooking = FunctionReturnType<typeof mobileApi.bookings.forCompanion>[number]
type MemberBookingTransaction = FunctionReturnType<typeof mobileApi.finance.memberBookingTransactions>[number]

export default function BookingHistoryScreen() {
  const member = useMobileMember()
  const memberBookings = useQuery(mobileApi.bookings.mine, member.status === 'ready' ? {} : 'skip')
  const companionBookings = useQuery(mobileApi.bookings.forCompanion, member.status === 'ready' ? {} : 'skip')
  const recentTransactions = useQuery(
    mobileApi.finance.memberBookingTransactions,
    member.status === 'ready' ? { limit: 5 } : 'skip',
  )
  const wallet = useQuery(mobileApi.finance.memberDashboard, bookingsWalletQueryArgs(member.status))

  if (member.status === 'signed_out') return <BookingState title="Sign in to see your bookings" action="Sign in" onPress={() => router.push('/auth')} />
  if (member.status === 'unconfigured') return <BookingState title="Bookings need account services" detail="Connect your account to view booking activity." />
  if (member.status === 'unavailable' || member.status === 'error') return <BookingState title="Bookings are unavailable" detail={member.message} />
  if (member.status !== 'ready' || memberBookings === undefined || companionBookings === undefined) return <PageSkeleton variant="bookings" />

  return (
    <BookingsList
      memberBookings={memberBookings}
      companionBookings={companionBookings}
      recentTransactions={recentTransactions}
      wallet={wallet}
    />
  )
}

function BookingsList({
  memberBookings,
  companionBookings,
  recentTransactions,
  wallet,
}: {
  memberBookings: MemberBooking[]
  companionBookings: CompanionBooking[]
  recentTransactions: MemberBookingTransaction[] | undefined
  wallet: BookingsWallet
}) {
  const theme = useAppTheme()
  const [view, setView] = useState<BookingsViewMode>('calendar')
  const [filter, setFilter] = useState<MemberBookingFilter>('active')
  const combined = useMemo(
    () => combineCalendarBookings(memberBookings as never, companionBookings as never),
    [companionBookings, memberBookings],
  )
  const grouped = useMemo(() => ({
    requests: filterMemberBookings(memberBookings as never, 'requests'),
    active: filterMemberBookings(memberBookings as never, 'active'),
    past: filterMemberBookings(memberBookings as never, 'past'),
  }), [memberBookings])
  const companionActive = useMemo(
    () => combined.filter((booking) => booking.perspective === 'companion'),
    [combined],
  )
  const visible = grouped[filter]
  const renderBooking = (booking: CombinedCalendarBooking) => {
    const route = bookingDetailRoute(booking)
    const participantName = calendarParticipantName(booking)
    const record = booking as unknown as MemberBooking & Partial<CompanionBooking>
    return (
      <BookingCard
        booking={{
          id: String(booking._id),
          participantName,
          participantPreposition: booking.perspective === 'companion' ? 'from' : undefined,
          category: record.category,
          mode: record.mode,
          requestedAt: booking.requestedAt,
          durationMinutes: record.durationMinutes,
          status: booking.status as MemberBooking['status'],
          memberTotalCentavos: record.memberTotalCentavos,
        }}
        onPress={() => router.push(route as never)}
      />
    )
  }

  return (
    <Screen contentStyle={styles.content}>
      <BookingsHeader wallet={wallet} onOpenWallet={() => router.push(BOOKINGS_WALLET_ROUTE as never)} />
      <SegmentedControl
        label="Booking view"
        value={view}
        onChange={setView}
        tone="social"
        style={styles.filters}
        options={[
          { value: 'calendar', label: 'Calendar' },
          { value: 'cards', label: 'Cards' },
        ]}
      />
      {view === 'calendar' ? (
        <BookingsCalendarView bookings={combined} renderBooking={renderBooking} />
      ) : (
        <>
          <SegmentedControl
            label="Booking status"
            value={filter}
            onChange={setFilter}
            tone="social"
            style={styles.filters}
            options={[
              { value: 'active', label: `Upcoming ${grouped.active.length}` },
              { value: 'requests', label: `Requests ${grouped.requests.length}` },
              { value: 'past', label: `Past ${grouped.past.length}` },
            ]}
          />
          {visible.length ? <View style={styles.list}>{visible.map((booking) => (
            <View key={`member-${String(booking._id)}`}>{renderBooking({ ...booking, perspective: 'member' } as CombinedCalendarBooking)}</View>
          ))}</View> : (
            <EmptyState
              icon={<AppIcon name="calendar-outline" color={theme.colors.textMuted} size={26} />}
              title={filter === 'active' ? 'No upcoming sessions' : filter === 'requests' ? 'No open requests' : 'No past bookings'}
              description={filter === 'past' ? 'Completed and closed bookings will appear here.' : 'Explore approved Companions when you are ready to make a plan.'}
              action={filter === 'past' ? undefined : <ActionButton label="Explore Companions" onPress={() => router.push('/nearby')} secondary />}
            />
          )}
          <View style={styles.companionSection}>
            <AppText variant="heading">Bookings as Companion</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>
              {companionActive.length === 0
                ? 'Incoming Companion requests appear here without leaving this calendar.'
                : `${companionActive.length} ${companionActive.length === 1 ? 'booking' : 'bookings'} for your Companion profile.`}
            </AppText>
            {companionActive.length ? (
              <View style={styles.list}>
                {companionActive.map((booking) => (
                  <View key={`companion-${String(booking._id)}`}>{renderBooking(booking)}</View>
                ))}
              </View>
            ) : null}
          </View>
        </>
      )}
      <View style={[styles.transactions, { borderTopColor: theme.colors.border }]}>
        <View style={styles.transactionsHeader}>
          <View style={styles.transactionsCopy}>
            <AppText variant="heading">Recent transactions</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>
              Holds, payments, and refunds from your bookings.
            </AppText>
          </View>
          {recentTransactions && recentTransactions.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View more transactions"
              onPress={() => router.push(TRANSACTIONS_ROUTE as never)}
              style={({ pressed }) => [styles.viewMore, pressed && styles.pressed]}>
              <AppText variant="label" color={theme.colors.socialText}>VIEW MORE</AppText>
            </Pressable>
          ) : null}
        </View>
        {recentTransactions === undefined ? (
          <AppText variant="caption" color={theme.colors.textMuted} accessibilityLiveRegion="polite">
            Loading transactions
          </AppText>
        ) : (
          <WalletActivityList
            rows={recentTransactions.map(bookingActivityRow)}
            emptyMessage="No booking transactions yet."
            onOpenBooking={(bookingId) => router.push(`/booking/${bookingId}` as never)}
          />
        )}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open Companion incoming bookings" onPress={() => router.push('/companion-bookings')} style={styles.companionLink}>
        <AppText variant="label" color={theme.colors.social}>COMPANION INCOMING BOOKINGS</AppText>
      </Pressable>
    </Screen>
  )
}

function BookingState({ title, detail, action, onPress, loading = false }: { title: string; detail?: string; action?: string; onPress?: () => void; loading?: boolean }) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="BOOKINGS" title={title} detail={detail} actionLabel={action} onAction={onPress} loading={loading} /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <BookingState title="Bookings are temporarily unavailable" detail="Please try again. No booking action was taken." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  state: { paddingHorizontal: 16 },
  filters: { marginBottom: 16 },
  list: { gap: 10 },
  companionSection: { gap: 8, marginTop: 20 },
  transactions: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 20, paddingTop: 16, gap: 10 },
  transactionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  transactionsCopy: { flex: 1, gap: 4 },
  viewMore: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  pressed: { opacity: 0.7 },
  companionLink: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 18 },
})
