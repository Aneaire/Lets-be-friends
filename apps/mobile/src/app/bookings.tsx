import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { BookingCard } from '@/components/BookingCard'
import { Screen } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type Booking = FunctionReturnType<typeof mobileApi.bookings.mine>[number]

export default function BookingHistoryScreen() {
  const member = useMobileMember()
  const theme = useAppTheme()
  const bookings = useQuery(mobileApi.bookings.mine, member.status === 'ready' ? {} : 'skip')

  if (member.status === 'signed_out') return <BookingState title="Sign in to see your bookings" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'demo') return <BookingState title="Booking history is unavailable in demo mode" action="Return home" onPress={() => router.replace('/')} />
  if (member.status === 'unavailable' || member.status === 'error') return <BookingState title="Bookings are unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready' || bookings === undefined) return <BookingState title="Loading your bookings" />

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.social}>BOOKINGS</AppText>
        <AppText variant="display">Your plans.</AppText>
        <AppText color={theme.colors.textMuted}>Requests, confirmed sessions, and past bookings appear here.</AppText>
      </View>
      {bookings.length === 0 ? (
        <BookingState title="No booking requests yet" detail="Explore verified Friend Hosts when you are ready to make a plan." action="Explore Friend Hosts" onPress={() => router.push('/explore')} embedded />
      ) : (
        <View style={styles.list}>{bookings.map((booking: Booking) => (
          <BookingCard
            key={booking._id}
            booking={{
              id: booking._id,
              hostName: booking.hostDisplayName,
              category: booking.category,
              mode: booking.mode,
              requestedAt: booking.requestedAt,
              durationMinutes: booking.durationMinutes,
              status: booking.status,
              memberTotalCentavos: booking.memberTotalCentavos,
            }}
            onPress={() => router.push({ pathname: '/booking/[id]', params: { id: String(booking._id) } })}
          />
        ))}</View>
      )}
    </Screen>
  )
}

function BookingState({ title, detail, action, onPress, embedded = false }: { title: string; detail?: string; action?: string; onPress?: () => void; embedded?: boolean }) {
  const theme = useAppTheme()
  const content = <><AppText variant="heading">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} secondary /> : null}</>
  if (embedded) return <View style={[styles.empty, { borderColor: theme.colors.border }]}>{content}</View>
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.social}>BOOKINGS</AppText>{content}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <BookingState title="Bookings are temporarily unavailable" detail="Please try again. Your account details are not shown in this error." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingBottom: 56 },
  header: { paddingTop: 24, gap: 12, marginBottom: 24 },
  list: { gap: 12 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  empty: { borderWidth: 1, borderRadius: 24, padding: 22, gap: 12 },
})
