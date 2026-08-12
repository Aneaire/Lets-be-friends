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

type HostBooking = FunctionReturnType<typeof mobileApi.bookings.forHost>[number]

export default function HostBookingsScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <HostBookingsState title="Sign in to view incoming bookings" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'demo') return <HostBookingsState title="Incoming bookings are unavailable in demo mode" action="Return to Profile" onPress={() => router.replace('/profile')} />
  if (member.status === 'unavailable' || member.status === 'error') return <HostBookingsState title="Incoming bookings are unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <HostBookingsState title="Loading incoming bookings" />
  return <ReadyHostBookingsScreen />
}

function ReadyHostBookingsScreen() {
  const theme = useAppTheme()
  const application = useQuery(mobileApi.hosts.myApplication, {})
  const bookings = useQuery(mobileApi.bookings.forHost, {})
  if (application === undefined || bookings === undefined) return <HostBookingsState title="Loading incoming bookings" />
  if (!application) return <HostBookingsState title="Create a Friend Host profile first" detail="Incoming booking requests appear after you have a Friend Host profile." action="Open Friend Host tools" onPress={() => router.replace('/friend-host')} />

  const active = bookings.filter((booking) => ['request_sent', 'accepted', 'verification_required', 'pending_admin_review'].includes(booking.status))
  const history = bookings.filter((booking) => !active.includes(booking))

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.social}>HOST BOOKINGS</AppText>
        <AppText variant="display">Incoming plans.</AppText>
        <AppText color={theme.colors.textMuted}>{active.length} active {active.length === 1 ? 'booking' : 'bookings'} for your Friend Host profile.</AppText>
      </View>
      {active.length === 0 ? (
        <View style={[styles.empty, { borderColor: theme.colors.border }]}>
          <AppText variant="heading">No one is waiting on you</AppText>
          <AppText color={theme.colors.textMuted}>New booking requests from members will appear here.</AppText>
        </View>
      ) : <BookingSection label="Active" bookings={active} />}
      {history.length > 0 ? <BookingSection label="History" bookings={history} /> : null}
      <ActionButton label="Friend Host profile and status" onPress={() => router.push('/friend-host')} intent="self" secondary />
      <ActionButton label="Return to Profile" onPress={() => router.replace('/profile')} intent="self" secondary />
    </Screen>
  )
}

function BookingSection({ label, bookings }: { label: string; bookings: HostBooking[] }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading">{label}</AppText>
      <View style={styles.list}>{bookings.map((booking) => <HostBookingRow key={booking._id} booking={booking} />)}</View>
    </View>
  )
}

function HostBookingRow({ booking }: { booking: HostBooking }) {
  const theme = useAppTheme()
  const status = bookingStatusPresentation[booking.status]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${booking.category} booking from ${booking.memberDisplayName}, ${status.label}`}
      onPress={() => router.push({ pathname: '/host-booking/[id]', params: { id: String(booking._id) } })}
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

function HostBookingsState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.social}>HOST BOOKINGS</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} secondary /> : null}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <HostBookingsState title="Incoming bookings are temporarily unavailable" detail="Please try again. No booking action was taken." action="Try again" onPress={retry} />
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
