import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import { useMobileAuth } from '@/auth/MobileAuth'
import { mobileApi } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { ActionButton } from '@/components/ActionButton'
import { BookingCard } from '@/components/BookingCard'
import { Brand } from '@/components/Brand'
import { CompanionCard } from '@/components/CompanionCard'
import { Screen, Section } from '@/components/Screen'
import { TrustThread } from '@/components/TrustThread'
import { AppText } from '@/components/Typography'
import { companions } from '@/data/companions'
import { mapApprovedCompanion, mapFixtureDiscoveryCompanion, type ApprovedCompanionRecord } from '@/data/companionViewModels'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type Booking = FunctionReturnType<typeof mobileApi.bookings.mine>[number]

function NotificationBellGlyph({ color }: { color: string }) {
  return (
    <View style={styles.bellGlyph} accessible={false}>
      <View style={[styles.bellDome, { borderColor: color }]} />
      <View style={[styles.bellClapper, { backgroundColor: color }]} />
    </View>
  )
}

export default function HomeScreen() {
  const theme = useAppTheme()
  const auth = useMobileAuth()
  const member = useMobileMember()
  const backend = useMobileBackendConfiguration()
  const bookings = useQuery(mobileApi.bookings.mine, member.status === 'ready' ? {} : 'skip')
  const approvedCompanions = useQuery(mobileApi.companions.listApproved, backend.status === 'configured' ? {} : 'skip')
  const notificationUnread = useQuery(mobileApi.notifications.unreadCount, member.status === 'ready' ? {} : 'skip') ?? 0
  const featuredCompanion = backend.status === 'configured'
    ? approvedCompanions?.[0] ? mapApprovedCompanion(approvedCompanions[0] as ApprovedCompanionRecord) : null
    : mapFixtureDiscoveryCompanion(companions[0])
  const accountName = member.status === 'ready'
    ? member.viewer.displayName
    : auth.status === 'signed_in'
      ? auth.displayName
      : auth.status === 'demo'
        ? 'Demo member'
        : 'Member account'
  const accountInitials = accountName.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'ME'

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.topBar}>
        <Brand compact />
        <View style={styles.topBarActions}>
          {member.status === 'ready' ? <Pressable
            accessibilityRole="button"
            accessibilityLabel={notificationUnread ? `Open notifications, ${notificationUnread} unread` : 'Open notifications'}
            onPress={() => router.push('/notifications' as never)}
            style={({ pressed }) => [styles.bellButton, { borderColor: theme.colors.border }, pressed && styles.pressed]}>
            <NotificationBellGlyph color={theme.colors.text} />
            {notificationUnread > 0 ? <View style={[styles.notificationBadge, { backgroundColor: theme.colors.inverse }]}><AppText variant="caption" color={theme.colors.inverseText}>{notificationUnread > 99 ? '99+' : notificationUnread}</AppText></View> : null}
          </Pressable> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => router.navigate('/profile')}
            style={({ pressed }) => [styles.memberButton, { borderColor: theme.colors.self }, pressed && styles.pressed]}>
            <AppText variant="label" color={theme.colors.self}>{accountInitials}</AppText>
          </Pressable>
        </View>
      </View>

      <View style={styles.hero}>
        <AppText variant="label" color={theme.colors.social}>TRUSTED COMPANY, ON YOUR TERMS</AppText>
        <AppText variant="display">Make room for a real connection.</AppText>
        <AppText color={theme.colors.textMuted}>
          Meet verified Companions for conversation, shared interests, and thoughtfully planned experiences.
        </AppText>
        <ActionButton label="Explore Companions" onPress={() => router.navigate('/explore')} />
      </View>

      {member.status === 'ready' ? (
        <Section>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionHeading}>
              <AppText variant="heading">Your bookings</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>Requests and upcoming plans</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="View all bookings" onPress={() => router.push('/bookings')} hitSlop={8}>
              <AppText variant="label" color={theme.colors.social}>VIEW ALL</AppText>
            </Pressable>
          </View>
          {bookings === undefined ? <AppText color={theme.colors.textMuted}>Loading bookings.</AppText> : bookings.length ? (
            <BookingCard
              booking={bookingCardView(bookings[0])}
              onPress={() => router.push({ pathname: '/booking/[id]', params: { id: String(bookings[0]._id) } })}
            />
          ) : <ActionButton label="Explore Companions" onPress={() => router.push('/explore')} secondary />}
        </Section>
      ) : null}

      <Section>
        <View style={styles.sectionHeading}>
          <AppText variant="heading">How trust travels</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>A clear thread from profile to booking</AppText>
        </View>
        <View style={[styles.trustCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <TrustThread items={[
            { title: 'Verified profiles', detail: 'Identity checks help members know who they are meeting.', tone: 'self' },
            { title: 'Visible Strengths', detail: 'Companions explain how they show up and what they enjoy.', tone: 'social' },
            { title: 'Clear availability', detail: 'Choose an online session or in-person session before reviewing a booking.', tone: 'social' },
          ]} />
        </View>
      </Section>

      <Section>
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeading}>
            <AppText variant="heading">A thoughtful match</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>Based on calm plans and good conversation</AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="See all Companions" onPress={() => router.navigate('/explore')} hitSlop={8}>
            <AppText variant="label" color={theme.colors.social}>SEE ALL</AppText>
          </Pressable>
        </View>
        {featuredCompanion ? (
          <CompanionCard companion={featuredCompanion} />
        ) : (
          <AppText color={theme.colors.textMuted}>
            {approvedCompanions === undefined ? 'Loading a thoughtful match.' : 'No Companion recommendation is available right now.'}
          </AppText>
        )}
      </Section>
    </Screen>
  )
}

function bookingCardView(booking: Booking) {
  return {
    id: String(booking._id),
    companionName: booking.companionDisplayName,
    category: booking.category,
    mode: booking.mode,
    requestedAt: booking.requestedAt,
    durationMinutes: booking.durationMinutes,
    status: booking.status,
    memberTotalCentavos: booking.memberTotalCentavos,
  }
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.state}>
      <AppText variant="label" color={theme.colors.social}>HOME UNAVAILABLE</AppText>
      <AppText variant="title">Your home screen could not be loaded</AppText>
      <AppText color={theme.colors.textMuted}>Please try again. Member details are not shown in this error.</AppText>
      <ActionButton label="Try again" onPress={retry} secondary />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  topBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberButton: { width: 46, height: 46, borderWidth: 2, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  bellButton: { position: 'relative', width: 42, height: 42, borderWidth: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  bellGlyph: { width: 20, height: 21, alignItems: 'center', justifyContent: 'flex-start' },
  bellDome: { width: 16, height: 16, borderWidth: 2, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  bellClapper: { width: 5, height: 3, marginTop: 1, borderRadius: 2 },
  notificationBadge: { position: 'absolute', top: -5, right: -7, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },
  hero: { paddingTop: 30, gap: 18 },
  sectionHeading: { gap: 4 },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 16 },
  trustCard: { borderWidth: 1, borderRadius: 24, padding: 20, marginTop: 16 },
})
