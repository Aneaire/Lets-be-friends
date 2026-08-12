import type { FunctionReturnType } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import { useRef, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { mobileApi, type BookingId } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { BookingEvidencePanel } from '@/components/BookingEvidencePanel'
import { Screen } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import {
  bookingActions,
  bookingStatusPresentation,
  formatBookingSchedule,
  formatBookingTotal,
  formatDuration,
} from '@/data/bookingViewModels'
import { safeProductError } from '@/data/productErrors'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type Booking = FunctionReturnType<typeof mobileApi.bookings.mine>[number]

export default function BookingDetailScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <DetailState title="Sign in to view this booking" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'demo') return <DetailState title="Booking details are unavailable in demo mode" action="Return home" onPress={() => router.replace('/')} />
  if (member.status === 'unavailable' || member.status === 'error') return <DetailState title="Booking details are unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <DetailState title="Loading booking details" />
  return <ReadyBookingDetailScreen />
}

function ReadyBookingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const bookingId = typeof params.id === 'string' ? params.id : ''
  const bookings = useQuery(mobileApi.bookings.mine, {})
  const cancelBooking = useMutation(mobileApi.bookings.cancel)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)

  if (bookings === undefined) return <DetailState title="Loading booking details" />
  const booking = bookings.find((item: Booking) => String(item._id) === bookingId)
  if (!booking) return <DetailState title="Booking not found" detail="This booking is not available in your member history." action="View all bookings" onPress={() => router.replace('/bookings')} />

  const actions = bookingActions(booking.status, {
    memberCompletedAt: booking.memberCompletedAt,
    hostCompletedAt: booking.hostCompletedAt,
  })

  async function cancel() {
    if (busyRef.current || !booking) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await cancelBooking({ bookingId: booking._id as BookingId, reason: 'Cancelled by member from the mobile app.' })
    } catch (mutationError) {
      setError(safeProductError('cancel_booking', mutationError))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function confirmCancel() {
    Alert.alert(
      'Cancel this booking?',
      'The booking will be cancelled. This cannot be undone in the mobile app.',
      [
        { text: 'Keep booking', style: 'cancel' },
        { text: 'Cancel booking', style: 'destructive', onPress: () => void cancel() },
      ],
    )
  }

  return <BookingDetail booking={booking} canCancel={actions.canCancel} busy={busy} error={error} onCancel={confirmCancel} />
}

function BookingDetail({ booking, canCancel, busy, error, onCancel }: {
  booking: Booking
  canCancel: boolean
  busy: boolean
  error: string
  onCancel: () => void
}) {
  const theme = useAppTheme()
  const status = bookingStatusPresentation[booking.status]
  const total = formatBookingTotal(booking.memberTotalCentavos)

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.social}>BOOKING DETAILS</AppText>
        <AppText variant="title">{booking.category}</AppText>
        <AppText color={theme.colors.textMuted}>with {booking.hostDisplayName}</AppText>
      </View>
      <View accessibilityLiveRegion="polite" style={[styles.status, { backgroundColor: theme.colors.socialSoft, borderColor: theme.colors.social }]}>
        <AppText variant="bodyStrong" color={theme.colors.social}>{status.label}</AppText>
        <AppText variant="caption">{status.explanation}</AppText>
      </View>
      <View style={[styles.details, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Detail label="Schedule" value={formatBookingSchedule(booking.requestedAt)} />
        <Detail label="Format" value={booking.mode === 'in_person' ? 'In-person session' : 'Online session'} />
        <Detail label="Duration" value={formatDuration(booking.durationMinutes)} />
        {total ? <Detail label="Booking total" value={total} /> : null}
        {booking.hostCity ? <Detail label="Friend Host location" value={booking.hostCity} /> : null}
      </View>
      {booking.notes ? <View style={styles.notes}><AppText variant="heading">Your notes</AppText><AppText color={theme.colors.textMuted}>{booking.notes}</AppText></View> : null}
      <BookingEvidencePanel
        bookingId={booking._id as BookingId}
        status={booking.status}
        pricingModel={booking.pricingModel}
        participantCompletedAt={booking.memberCompletedAt}
        otherParticipantCompletedAt={booking.hostCompletedAt}
        participantRole="member_end"
      />
      {error ? <AppText accessibilityRole="alert" color={theme.colors.social}>{error}</AppText> : null}
      <View style={styles.actions}>
        {canCancel ? <ActionButton label={busy ? 'Cancelling booking' : 'Cancel booking'} onPress={onCancel} disabled={busy} secondary /> : null}
        <ActionButton label="Open Messages" onPress={() => router.push('/messages')} />
        <ActionButton label="View all bookings" onPress={() => router.replace('/bookings')} secondary />
      </View>
    </Screen>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme()
  return <View style={styles.detailRow}><AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText><AppText variant="bodyStrong" style={styles.detailValue}>{value}</AppText></View>
}

function DetailState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.social}>BOOKINGS</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} secondary /> : null}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <DetailState title="Booking details are temporarily unavailable" detail="Please try again. No action was taken." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, paddingBottom: 64, gap: 18 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  header: { gap: 6 },
  status: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 5 },
  details: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 16 },
  detailRow: { gap: 4 },
  detailValue: { flex: 1 },
  notes: { gap: 8 },
  actions: { gap: 10, marginTop: 8 },
})
