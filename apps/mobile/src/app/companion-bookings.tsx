import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { Screen } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import { bookingStatusPresentation, formatBookingSchedule, formatDuration } from '@/data/bookingViewModels'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type CompanionBooking = FunctionReturnType<typeof mobileApi.bookings.forCompanion>[number]

export default function CompanionBookingsScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <CompanionBookingsState title="Sign in to view incoming bookings" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <CompanionBookingsState title="Incoming bookings need account services" action="Return to Profile" onPress={() => router.replace('/profile')} />
  if (member.status === 'unavailable' || member.status === 'error') return <CompanionBookingsState title="Incoming bookings are unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <CompanionBookingsState title="Loading incoming bookings" />
  return <ReadyCompanionBookingsScreen />
}

function ReadyCompanionBookingsScreen() {
  const theme = useAppTheme()
  const application = useQuery(mobileApi.companions.myApplication, {})
  const bookings = useQuery(mobileApi.bookings.forCompanion, {})
  if (application === undefined || bookings === undefined) return <CompanionBookingsState title="Loading incoming bookings" />
  if (!application) return <CompanionBookingsState title="Create a Companion profile first" detail="Incoming booking requests appear after you have a Companion profile." action="Open Companion tools" onPress={() => router.replace('/companion')} />

  const active = bookings.filter((booking) => ['request_sent', 'accepted', 'verification_required', 'pending_admin_review'].includes(booking.status))
  const history = bookings.filter((booking) => !active.includes(booking))

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.social}>INCOMING BOOKINGS</AppText>
        <AppText variant="display">Incoming plans.</AppText>
        <AppText color={theme.colors.textMuted}>{active.length} active {active.length === 1 ? 'booking' : 'bookings'} for your Companion profile.</AppText>
      </View>
      {active.length === 0 ? (
        <View style={[styles.empty, { borderColor: theme.colors.border }]}>
          <AppText variant="heading">No one is waiting on you</AppText>
          <AppText color={theme.colors.textMuted}>New booking requests from members will appear here.</AppText>
        </View>
      ) : <BookingSection label="Active" bookings={active} />}
      {history.length > 0 ? <BookingSection label="History" bookings={history} /> : null}
      <ActionButton label="Companion profile and status" onPress={() => router.push('/companion')} intent="self" secondary />
      <ActionButton label="Return to Profile" onPress={() => router.replace('/profile')} intent="self" secondary />
    </Screen>
  )
}

function BookingSection({ label, bookings }: { label: string; bookings: CompanionBooking[] }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading">{label}</AppText>
      <View style={styles.list}>{bookings.map((booking) => <CompanionBookingRow key={booking._id} booking={booking} />)}</View>
    </View>
  )
}

function CompanionBookingRow({ booking }: { booking: CompanionBooking }) {
  const theme = useAppTheme()
  const status = bookingStatusPresentation[booking.status]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${booking.category} booking from ${booking.memberDisplayName}, ${status.label}`}
      onPress={() => router.push({ pathname: '/companion-booking/[id]', params: { id: String(booking._id) } })}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }, pressed && styles.pressed]}>
      <View style={styles.cardHead}>
        <View style={styles.cardCopy}>
          <AppText variant="bodyStrong">{booking.memberDisplayName}</AppText>
          <AppText>{booking.category}</AppText>
        </View>
        <AppText variant="caption" color={theme.colors.social}>{status.label}</AppText>
      </View>
      <AppText variant="caption" color={theme.colors.textMuted}>{formatBookingSchedule(booking.requestedAt)}</AppText>
      <AppText variant="caption" color={theme.colors.textMuted}>{booking.mode === 'in_person' ? 'In-person session' : 'Online session'}, {formatDuration(booking.durationMinutes)}</AppText>
    </Pressable>
  )
}

function CompanionBookingsState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.social}>INCOMING BOOKINGS</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} secondary /> : null}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <CompanionBookingsState title="Incoming bookings are temporarily unavailable" detail="Please try again. No booking action was taken." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, paddingBottom: 64, gap: 22 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  header: { gap: 10 },
  section: { gap: 12 },
  list: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 7 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardCopy: { flex: 1, gap: 2 },
  empty: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 8 },
  pressed: { opacity: 0.72 },
})
