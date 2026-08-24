import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { StateView } from '@/design-system/molecules/StateView'
import { BookingCard } from '@/design-system/organisms/BookingCard'
import { Screen } from '@/design-system/templates/Screen'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type CompanionBooking = FunctionReturnType<typeof mobileApi.bookings.forCompanion>[number]

export default function CompanionBookingsScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <CompanionBookingsState title="Sign in to view incoming bookings" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <CompanionBookingsState title="Incoming bookings need account services" action="Return to Profile" onPress={() => router.replace('/profile')} />
  if (member.status === 'unavailable' || member.status === 'error') return <CompanionBookingsState title="Incoming bookings are unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <CompanionBookingsState title="Loading incoming bookings" loading />
  return <ReadyCompanionBookingsScreen />
}

function ReadyCompanionBookingsScreen() {
  const theme = useAppTheme()
  const application = useQuery(mobileApi.companions.myApplication, {})
  const bookings = useQuery(mobileApi.bookings.forCompanion, {})
  if (application === undefined || bookings === undefined) return <CompanionBookingsState title="Loading incoming bookings" loading />
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
        <StateView
          embedded
          title="No one is waiting on you"
          detail="New booking requests from members will appear here."
        />
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
  return (
    <BookingCard
      booking={{
        id: String(booking._id),
        participantName: booking.memberDisplayName,
        participantPreposition: 'from',
        category: booking.category,
        mode: booking.mode,
        requestedAt: booking.requestedAt,
        durationMinutes: booking.durationMinutes,
        status: booking.status,
        memberTotalCentavos: booking.memberTotalCentavos,
      }}
      onPress={() => router.push({ pathname: '/companion-booking/[id]', params: { id: String(booking._id) } })}
    />
  )
}

function CompanionBookingsState({ title, detail, action, onPress, loading = false }: { title: string; detail?: string; action?: string; onPress?: () => void; loading?: boolean }) {
  return (
    <Screen scroll={false} contentStyle={styles.state}>
      <StateView
        eyebrow="INCOMING BOOKINGS"
        title={title}
        detail={detail}
        actionLabel={action}
        onAction={onPress}
        loading={loading}
      />
    </Screen>
  )
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <CompanionBookingsState title="Incoming bookings are temporarily unavailable" detail="Please try again. No booking action was taken." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 40, gap: 16 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  header: { gap: 10 },
  section: { gap: 12 },
  list: { gap: 12 },
})
