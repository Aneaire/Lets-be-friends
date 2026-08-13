import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { mobileApi, type BookingId } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { BookingCancelAction } from '@/components/BookingCancelAction'
import { BookingEvidencePanel } from '@/components/BookingEvidencePanel'
import { BookingLifecycleDetails } from '@/components/BookingLifecycleDetails'
import { BookingMessagesButton } from '@/components/BookingMessagesButton'
import { BookingSafetyActions } from '@/components/BookingSafetyActions'
import { Screen } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import { bookingActionVisibility } from '@/data/bookingLifecycle'
import {
  bookingStatusPresentation,
  formatBookingSchedule,
  formatBookingTotal,
  formatDuration,
} from '@/data/bookingViewModels'
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

  if (bookings === undefined) return <DetailState title="Loading booking details" />
  const booking = bookings.find((item: Booking) => String(item._id) === bookingId)
  if (!booking) return <DetailState title="Booking not found" detail="This booking is not available in your member history." action="View all bookings" onPress={() => router.replace('/bookings')} />

  const actions = bookingActionVisibility({
    status: booking.status,
    viewerRole: 'member',
    memberCompletedAt: booking.memberCompletedAt,
    companionCompletedAt: booking.companionCompletedAt,
    settlementState: booking.settlementState,
  })

  return <BookingDetail booking={booking} canEditRequest={actions.canEditRequest} canCancel={actions.canCancel} />
}

function BookingDetail({ booking, canEditRequest, canCancel }: {
  booking: Booking
  canEditRequest: boolean
  canCancel: boolean
}) {
  const theme = useAppTheme()
  const status = bookingStatusPresentation[booking.status]
  const total = formatBookingTotal(booking.memberTotalCentavos)

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.social}>BOOKING DETAILS</AppText>
        <AppText variant="title">{booking.category}</AppText>
        <AppText color={theme.colors.textMuted}>with {booking.companionDisplayName}</AppText>
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
        {booking.companionCity ? <Detail label="Companion location" value={booking.companionCity} /> : null}
      </View>
      {booking.notes ? <View style={styles.notes}><AppText variant="heading">Your notes</AppText><AppText color={theme.colors.textMuted}>{booking.notes}</AppText></View> : null}
      <BookingLifecycleDetails
        status={booking.status}
        viewerRole="member"
        memberId={String(booking.memberId)}
        companionUserId={booking.companionUserId ? String(booking.companionUserId) : undefined}
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
      <BookingEvidencePanel
        bookingId={booking._id as BookingId}
        status={booking.status}
        pricingModel={booking.pricingModel}
        participantCompletedAt={booking.memberCompletedAt}
        otherParticipantCompletedAt={booking.companionCompletedAt}
        participantRole="member_end"
      />
      <BookingSafetyActions
        bookingId={booking._id as BookingId}
        status={booking.status}
        viewerHasReviewed={booking.viewerHasReviewed}
      />
      <View style={styles.actions}>
        {canEditRequest ? <ActionButton label="Edit request" onPress={() => router.push(`../booking-edit/${String(booking._id)}`)} intent="self" secondary /> : null}
        {canCancel ? <BookingCancelAction bookingId={booking._id as BookingId} participantLabel="member" /> : null}
        <BookingMessagesButton otherUserId={booking.companionUserId ? String(booking.companionUserId) : undefined} />
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
