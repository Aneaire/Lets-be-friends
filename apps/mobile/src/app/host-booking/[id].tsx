import { formatPhp } from '@lets-be-friends/shared'
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
import { bookingStatusPresentation, formatBookingSchedule, formatDuration } from '@/data/bookingViewModels'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type HostBooking = FunctionReturnType<typeof mobileApi.bookings.forHost>[number]

export default function HostBookingDetailScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <HostDetailState title="Sign in to view this Friend Host booking" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'demo') return <HostDetailState title="Friend Host booking details are unavailable in demo mode" action="Return to Profile" onPress={() => router.replace('/profile')} />
  if (member.status === 'unavailable' || member.status === 'error') return <HostDetailState title="This Friend Host booking is unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <HostDetailState title="Loading Friend Host booking details" />
  return <ReadyHostBookingDetail />
}

function ReadyHostBookingDetail() {
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : ''
  const bookings = useQuery(mobileApi.bookings.forHost, {})
  const decide = useMutation(mobileApi.bookings.hostDecision)
  const [busy, setBusy] = useState<'accepted' | 'declined' | null>(null)
  const [message, setMessage] = useState('')
  const busyRef = useRef(false)

  if (bookings === undefined) return <HostDetailState title="Loading Friend Host booking details" />
  const booking = bookings.find((item: HostBooking) => String(item._id) === id)
  if (!booking) return <HostDetailState title="Friend Host booking not found" detail="This booking is not available for your Friend Host profile." action="View incoming bookings" onPress={() => router.replace('/host-bookings')} />

  async function saveDecision(decision: 'accepted' | 'declined') {
    if (busyRef.current || booking?.status !== 'request_sent') return
    busyRef.current = true
    setBusy(decision)
    setMessage('')
    try {
      await decide({
        bookingId: booking._id as BookingId,
        decision,
        note: decision === 'accepted' ? 'Accepted by Friend Host from the mobile app.' : 'Declined by Friend Host from the mobile app.',
      })
      setMessage(decision === 'accepted' ? 'Booking accepted. The member can see the live decision.' : 'Booking declined. The member can see the live decision.')
    } catch {
      setMessage(decision === 'accepted'
        ? 'This booking could not be accepted. Refresh the booking and try again.'
        : 'This booking could not be declined. Refresh the booking and try again.')
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }

  function confirmDecision(decision: 'accepted' | 'declined') {
    const accepting = decision === 'accepted'
    Alert.alert(
      accepting ? 'Accept this booking?' : 'Decline this booking?',
      accepting
        ? 'Confirm that you can host this experience at the listed schedule and format.'
        : 'The member will see that the booking was declined. This decision cannot be changed in the mobile app.',
      [
        { text: accepting ? 'Keep pending' : 'Do not decline', style: 'cancel' },
        { text: accepting ? 'Accept booking' : 'Decline booking', style: accepting ? 'default' : 'destructive', onPress: () => void saveDecision(decision) },
      ],
    )
  }

  return <HostBookingDetail booking={booking} busy={busy} message={message} onDecision={confirmDecision} />
}

function HostBookingDetail({ booking, busy, message, onDecision }: {
  booking: HostBooking
  busy: 'accepted' | 'declined' | null
  message: string
  onDecision: (decision: 'accepted' | 'declined') => void
}) {
  const theme = useAppTheme()
  const status = bookingStatusPresentation[booking.status]
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.social}>HOST BOOKING</AppText>
        <AppText variant="title">{booking.category}</AppText>
        <AppText color={theme.colors.textMuted}>requested by {booking.memberDisplayName}</AppText>
      </View>
      <View accessibilityLiveRegion="polite" style={[styles.status, { backgroundColor: theme.colors.socialSoft, borderColor: theme.colors.social }]}>
        <AppText variant="bodyStrong" color={theme.colors.social}>{status.label}</AppText>
        <AppText variant="caption">{status.explanation}</AppText>
      </View>
      <View style={[styles.details, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Detail label="Schedule" value={formatBookingSchedule(booking.requestedAt)} />
        <Detail label="Format" value={booking.mode === 'in_person' ? 'In-person session' : 'Online session'} />
        <Detail label="Duration" value={formatDuration(booking.durationMinutes)} />
        {booking.hostEntitlementCentavos !== undefined ? <Detail label="Friend Host entitlement" value={formatPhp(booking.hostEntitlementCentavos)} /> : null}
        {booking.memberTotalCentavos !== undefined ? <Detail label="Member booking total" value={formatPhp(booking.memberTotalCentavos)} /> : null}
      </View>
      {booking.notes ? <View style={styles.notes}><AppText variant="heading">Member notes</AppText><AppText color={theme.colors.textMuted}>{booking.notes}</AppText></View> : null}
      {booking.status === 'request_sent' ? (
        <View style={styles.actions}>
          <ActionButton label={busy === 'accepted' ? 'Accepting booking' : 'Accept booking'} onPress={() => onDecision('accepted')} disabled={busy !== null} />
          <ActionButton label={busy === 'declined' ? 'Declining booking' : 'Decline booking'} onPress={() => onDecision('declined')} disabled={busy !== null} secondary />
        </View>
      ) : null}
      <BookingEvidencePanel
        bookingId={booking._id as BookingId}
        status={booking.status}
        pricingModel={booking.pricingModel}
        participantCompletedAt={booking.hostCompletedAt}
        otherParticipantCompletedAt={booking.memberCompletedAt}
        participantRole="host_start"
      />
      {message ? <AppText accessibilityLiveRegion="polite" color={theme.colors.textMuted}>{message}</AppText> : null}
      <View style={styles.actions}>
        <ActionButton label="Open Messages" onPress={() => router.push('/messages')} />
        <ActionButton label="View incoming bookings" onPress={() => router.replace('/host-bookings')} secondary />
      </View>
    </Screen>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme()
  return <View style={styles.detailRow}><AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText><AppText variant="bodyStrong">{value}</AppText></View>
}

function HostDetailState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.social}>HOST BOOKING</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} secondary /> : null}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <HostDetailState title="Friend Host booking details are temporarily unavailable" detail="Please try again. No booking action was taken." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, paddingBottom: 64, gap: 18 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  header: { gap: 6 },
  status: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 5 },
  details: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 16 },
  detailRow: { gap: 4 },
  notes: { gap: 8 },
  actions: { gap: 10 },
})
