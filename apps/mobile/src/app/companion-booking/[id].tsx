import { formatPhp } from '@lets-be-friends/shared'
import type { FunctionReturnType } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { mobileApi, type BookingId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { BookingCancelAction } from '@/features/booking/BookingCancelAction'
import { BookingCompletionAction } from '@/features/booking/BookingCompletionAction'
import { BookingEvidencePanel } from '@/design-system/organisms/BookingEvidencePanel'
import { BookingLifecycleDetails } from '@/design-system/organisms/BookingLifecycleDetails'
import { BookingMessagesButton } from '@/features/booking/BookingMessagesButton'
import { PlanThread } from '@/features/booking/PlanThread'
import { BookingSafetyActions } from '@/features/booking/BookingSafetyActions'
import { Screen } from '@/design-system/templates/Screen'
import { AppText } from '@/design-system/atoms/Typography'
import { bookingActionVisibility } from '@/data/bookingLifecycle'
import { bookingStatusPresentation, formatBookingSchedule, formatDuration } from '@/data/bookingViewModels'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type CompanionBooking = FunctionReturnType<typeof mobileApi.bookings.forCompanion>[number]

export default function CompanionBookingDetailScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <CompanionDetailState title="Sign in to view this Companion booking" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <CompanionDetailState title="Booking details need account services" action="Return to Profile" onPress={() => router.replace('/profile')} />
  if (member.status === 'unavailable' || member.status === 'error') return <CompanionDetailState title="This Companion booking is unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <CompanionDetailState title="Loading Companion booking details" />
  return <ReadyCompanionBookingDetail viewerId={String(member.viewer._id)} />
}

function ReadyCompanionBookingDetail({ viewerId }: { viewerId: string }) {
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : ''
  const bookings = useQuery(mobileApi.bookings.forCompanion, {})
  const decide = useMutation(mobileApi.bookings.companionDecision)
  const [busy, setBusy] = useState<'accepted' | 'declined' | null>(null)
  const [message, setMessage] = useState('')
  useAppToastMessage(message)
  const busyRef = useRef(false)

  if (bookings === undefined) return <CompanionDetailState title="Loading Companion booking details" />
  const booking = bookings.find((item: CompanionBooking) => String(item._id) === id)
  if (!booking) return <CompanionDetailState title="Companion booking not found" detail="This booking is not available for your Companion profile." action="View incoming bookings" onPress={() => router.replace('/companion-bookings')} />

  async function saveDecision(decision: 'accepted' | 'declined') {
    if (busyRef.current || booking?.status !== 'request_sent') return
    busyRef.current = true
    setBusy(decision)
    setMessage('')
    try {
      await decide({
        bookingId: booking._id as BookingId,
        decision,
        note: decision === 'accepted' ? 'Accepted by Companion from the mobile app.' : 'Declined by Companion from the mobile app.',
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
        ? 'Confirm that you can join this experience as the Companion at the listed schedule and format.'
        : 'The member will see that the booking was declined. This decision cannot be changed in the mobile app.',
      [
        { text: accepting ? 'Keep pending' : 'Do not decline', style: 'cancel' },
        { text: accepting ? 'Accept booking' : 'Decline booking', style: accepting ? 'default' : 'destructive', onPress: () => void saveDecision(decision) },
      ],
    )
  }

  const actions = bookingActionVisibility({
    status: booking.status,
    viewerRole: 'companion',
    memberCompletedAt: booking.memberCompletedAt,
    companionCompletedAt: booking.companionCompletedAt,
    settlementState: booking.settlementState,
  })

  return <CompanionBookingDetail booking={booking} viewerId={viewerId} canCancel={actions.canCancel} busy={busy} message={message} onDecision={confirmDecision} />
}

function CompanionBookingDetail({ booking, viewerId, canCancel, busy, message, onDecision }: {
  booking: CompanionBooking
  viewerId: string
  canCancel: boolean
  busy: 'accepted' | 'declined' | null
  message: string
  onDecision: (decision: 'accepted' | 'declined') => void
}) {
  const theme = useAppTheme()
  const status = bookingStatusPresentation[booking.status]
  const [evidenceReady, setEvidenceReady] = useState(Boolean(booking.companionCompletedAt))
  const handleEvidenceDecision = useCallback((ready: boolean) => setEvidenceReady(ready), [])
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.social}>INCOMING BOOKING</AppText>
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
        {booking.companionEarningsCentavos !== undefined ? <Detail label="Companion amount in booking calculation" value={formatPhp(booking.companionEarningsCentavos)} /> : null}
        {booking.memberTotalCentavos !== undefined ? <Detail label="Member booking total" value={formatPhp(booking.memberTotalCentavos)} /> : null}
      </View>
      {booking.notes ? <View style={styles.notes}><AppText variant="heading">Member notes</AppText><AppText color={theme.colors.textMuted}>{booking.notes}</AppText></View> : null}
      <PlanThread status={booking.status} requestedAt={booking.requestedAt} memberCompletedAt={booking.memberCompletedAt} companionCompletedAt={booking.companionCompletedAt} />
      <BookingLifecycleDetails
        status={booking.status}
        viewerRole="companion"
        memberId={String(booking.memberId)}
        companionUserId={viewerId}
        memberDisplayName={booking.memberDisplayName}
        companionDisplayName={booking.companionDisplayName}
        memberCompletedAt={booking.memberCompletedAt}
        companionCompletedAt={booking.companionCompletedAt}
        cancelledByUserId={booking.cancelledByUserId ? String(booking.cancelledByUserId) : undefined}
        cancelledAt={booking.cancelledAt}
        cancellationReason={booking.cancellationReason}
        settlementState={booking.settlementState}
        settlementEligibleAt={booking.settlementEligibleAt}
        settlementBlockedAt={booking.settlementBlockedAt}
        settlementResolvedAt={booking.settlementResolvedAt}
        settlementResolution={booking.settlementResolution}
      />
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
        participantCompletedAt={booking.companionCompletedAt}
        otherParticipantCompletedAt={booking.memberCompletedAt}
        participantRole="companion_start"
        onDecisionChange={handleEvidenceDecision}
      />
      <BookingCompletionAction
        bookingId={booking._id as BookingId}
        status={booking.status}
        pricingModel={booking.pricingModel}
        requestedAt={booking.requestedAt}
        durationMinutes={booking.durationMinutes}
        viewerRole="companion"
        participantCompletedAt={booking.companionCompletedAt}
        otherParticipantCompletedAt={booking.memberCompletedAt}
        evidenceReady={evidenceReady}
      />
      <BookingSafetyActions
        bookingId={booking._id as BookingId}
        status={booking.status}
        viewerHasReviewed={booking.viewerHasReviewed}
      />
      <View style={styles.actions}>
        {canCancel ? <BookingCancelAction bookingId={booking._id as BookingId} participantLabel="Companion" /> : null}
        <BookingMessagesButton otherUserId={String(booking.memberId)} />
        <ActionButton label="View incoming bookings" onPress={() => router.replace('/companion-bookings')} secondary />
      </View>
    </Screen>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme()
  return <View style={styles.detailRow}><AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText><AppText variant="bodyStrong">{value}</AppText></View>
}

function CompanionDetailState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.social}>INCOMING BOOKING</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} secondary /> : null}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <CompanionDetailState title="Companion booking details are temporarily unavailable" detail="Please try again. No booking action was taken." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 40, gap: 16 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  header: { gap: 6 },
  status: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 5 },
  details: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 16 },
  detailRow: { gap: 4 },
  notes: { gap: 8 },
  actions: { gap: 10 },
})
