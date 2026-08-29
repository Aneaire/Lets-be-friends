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
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type Booking = FunctionReturnType<typeof mobileApi.bookings.mine>[number]
type Filter = 'active' | 'requests' | 'past'

export default function BookingHistoryScreen() {
  const member = useMobileMember()
  const bookings = useQuery(mobileApi.bookings.mine, member.status === 'ready' ? {} : 'skip')

  if (member.status === 'signed_out') return <BookingState title="Sign in to see your bookings" action="Sign in" onPress={() => router.push('/auth')} />
  if (member.status === 'unconfigured') return <BookingState title="Bookings need account services" detail="Connect your account to view booking activity." />
  if (member.status === 'unavailable' || member.status === 'error') return <BookingState title="Bookings are unavailable" detail={member.message} />
  if (member.status !== 'ready' || bookings === undefined) return <PageSkeleton variant="bookings" />

  return <BookingsList bookings={bookings} />
}

function BookingsList({ bookings }: { bookings: Booking[] }) {
  const theme = useAppTheme()
  const [filter, setFilter] = useState<Filter>('active')
  const grouped = useMemo(() => ({
    requests: bookings.filter((booking) => ['draft', 'verification_required', 'pending_admin_review', 'request_sent'].includes(booking.status)),
    active: bookings.filter((booking) => booking.status === 'accepted'),
    past: bookings.filter((booking) => ['declined', 'cancelled', 'completed', 'review_window', 'closed'].includes(booking.status)),
  }), [bookings])
  const visible = grouped[filter]

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="title">Bookings</AppText>
        <AppText color={theme.colors.textMuted}>Scan requests, upcoming plans, and history.</AppText>
      </View>
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
        <BookingCard
          key={booking._id}
          booking={{
            id: booking._id,
            participantName: booking.companionDisplayName,
            category: booking.category,
            mode: booking.mode,
            requestedAt: booking.requestedAt,
            durationMinutes: booking.durationMinutes,
            status: booking.status,
            memberTotalCentavos: booking.memberTotalCentavos,
          }}
          onPress={() => router.push({ pathname: '/booking/[id]', params: { id: String(booking._id) } })}
        />
      ))}</View> : (
        <EmptyState
          icon={<AppIcon name="calendar-outline" color={theme.colors.textMuted} size={26} />}
          title={filter === 'active' ? 'No upcoming sessions' : filter === 'requests' ? 'No open requests' : 'No past bookings'}
          description={filter === 'past' ? 'Completed and closed bookings will appear here.' : 'Explore approved Companions when you are ready to make a plan.'}
          action={filter === 'past' ? undefined : <ActionButton label="Explore Companions" onPress={() => router.push('/explore')} secondary />}
        />
      )}
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
  header: { paddingTop: 16, gap: 5, marginBottom: 16 },
  filters: { marginBottom: 16 },
  list: { gap: 10 },
  companionLink: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 18 },
})
