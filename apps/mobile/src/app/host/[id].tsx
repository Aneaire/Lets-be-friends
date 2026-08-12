import { useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import { Alert, Pressable, StyleSheet, View } from 'react-native'

import { mobileApi, type HostProfileId } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { ActionButton } from '@/components/ActionButton'
import { Avatar } from '@/components/Avatar'
import { Chip } from '@/components/Chip'
import { Screen, Section } from '@/components/Screen'
import { TrustThread } from '@/components/TrustThread'
import { AppText } from '@/components/Typography'
import { getFriendHost } from '@/data/hosts'
import {
  mapApprovedHost,
  mapFixtureHost,
  mapPublicHost,
  resolveConnectedHost,
  resolveHostBookingAction,
  type ApprovedHostRecord,
  type HostDataSource,
  type HostDetailViewModel,
} from '@/data/hostViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function FriendHostProfileScreen() {
  const params = useLocalSearchParams<{ id?: string; source?: HostDataSource }>()
  const configuration = useMobileBackendConfiguration()
  const id = typeof params.id === 'string' ? params.id : ''

  if (params.source === 'local_demo' || configuration.status !== 'configured') {
    const fixture = getFriendHost(id)
    return fixture ? <HostDetail host={mapFixtureHost(fixture)} /> : <HostNotFound local />
  }
  return <ConnectedHostDirectory id={id} />
}

function ConnectedHostDirectory({ id }: { id: string }) {
  const result = useQuery(mobileApi.hosts.listApproved, {})
  if (result === undefined) return <HostLoading />

  const resolution = resolveConnectedHost(result as ApprovedHostRecord[], id)
  if (resolution.kind === 'not_found') return <HostNotFound />
  if (resolution.kind === 'demo') {
    const record = resolution.record
    return <HostDetail host={{ ...mapApprovedHost(record), bio: record.bio, boundaries: record.boundaries ?? [] }} />
  }
  return <ConnectedHost record={resolution.record} />
}

function ConnectedHost({ record }: { record: ApprovedHostRecord }) {
  const result = useQuery(mobileApi.hosts.getPublic, { hostProfileId: record._id as HostProfileId })
  if (result === undefined) return <HostLoading />
  if (result === null) return <HostNotFound />
  return <HostDetail host={mapPublicHost(result as ApprovedHostRecord)} />
}

function HostDetail({ host }: { host: HostDetailViewModel }) {
  const theme = useAppTheme()
  const isLocalDemo = host.source === 'local_demo'
  const isBackendDemo = host.source === 'backend_demo'
  const modeLabels = host.sessionModes.map((mode) => mode === 'online' ? 'Online' : 'In person')
  const bookingAction = resolveHostBookingAction(host)
  const bookingDisabled = bookingAction.kind === 'own_profile' || bookingAction.kind === 'unavailable'

  function handleBookingAction() {
    if (bookingAction.kind === 'sign_in') {
      router.push('/auth')
      return
    }
    if (bookingAction.kind === 'verification') {
      Alert.alert('Verification required', bookingAction.explanation)
      return
    }
    if (bookingAction.kind === 'book') {
      router.push({ pathname: '/booking/new', params: { hostProfileId: host.id } })
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.navRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => goBackOrExplore()}
          style={({ pressed }) => [styles.backButton, { borderColor: theme.colors.border }, pressed && styles.pressed]}>
          <AppText variant="heading">‹</AppText>
        </Pressable>
        <AppText variant="label" color={theme.colors.social}>FRIEND HOST</AppText>
        <View style={styles.navSpacer} />
      </View>

      <View style={styles.profileHero}>
        <Avatar uri={host.imageUrl} name={host.name} size={116} />
        <View style={styles.profileCopy}>
          <View style={styles.verifiedRow}>
            <AppText variant="title">{host.name}{host.localOnly ? `, ${host.localOnly.age}` : ''}</AppText>
            {host.verified && <View accessibilityLabel="Identity verified" style={[styles.verified, { backgroundColor: theme.colors.self }]} />}
          </View>
          <AppText variant="caption" color={theme.colors.textMuted}>
            {[host.localOnly?.pronouns, host.location].filter(Boolean).join(' · ')}
          </AppText>
          {host.distanceLabel ? <AppText variant="caption" color={theme.colors.textMuted}>{host.distanceLabel}</AppText> : null}
        </View>
      </View>

      <AppText variant="heading" style={styles.tagline}>{host.intro}</AppText>

      <View accessibilityLiveRegion="polite" style={[styles.statusCard, { backgroundColor: theme.colors.socialSoft, borderColor: theme.colors.social }]}>
        <AppText variant="label" color={theme.colors.social}>
          {isLocalDemo ? 'LOCAL DEMO PROFILE' : isBackendDemo ? 'EXAMPLE PROFILE' : host.bookable ? 'PUBLIC PROFILE' : 'NOT BOOKABLE'}
        </AppText>
        <AppText variant="caption">
          {isLocalDemo
            ? 'This profile and its schedule are local fixture data. No booking request is sent.'
            : isBackendDemo
              ? 'This is an example profile provided by the service. It is not a live Friend Host profile and cannot be booked.'
              : host.bookable
                ? bookingAction.explanation
                : 'This Friend Host is not accepting booking requests right now.'}
        </AppText>
      </View>

      <View style={[styles.metrics, { borderColor: theme.colors.border }]}>
        <Metric
          value={typeof host.rating === 'number' ? `${host.rating} ★` : 'New'}
          label={typeof host.reviewCount === 'number' ? `${host.reviewCount} reviews` : 'No rating shown'}
        />
        <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />
        <Metric value={modeLabels.join(' + ')} label="session format" />
        {host.verified ? (
          <>
            <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />
            <Metric value="Verified" label="identity" accent="self" />
          </>
        ) : null}
      </View>

      {host.bio ? (
        <Section>
          <AppText variant="heading">About this Friend Host</AppText>
          <AppText style={styles.sectionCopy} color={theme.colors.textMuted}>{host.bio}</AppText>
        </Section>
      ) : null}

      <Section>
        <AppText variant="heading">Trust thread</AppText>
        <View style={styles.threadWrap}>
          <TrustThread items={[
            ...(host.verified ? [{ title: 'Identity verified', detail: 'This approved public profile has a current identity approval.', tone: 'self' as const }] : []),
            { title: 'Strengths shared', detail: host.strengths.join(' · '), tone: 'social' },
            { title: 'Session format', detail: modeLabels.join(' · '), tone: 'social' },
          ]} />
        </View>
      </Section>

      <Section>
        <AppText variant="heading">Strengths</AppText>
        <View style={styles.chips}>
          {host.strengths.map((strength) => <Chip key={strength} label={strength} />)}
        </View>
      </Section>

      {(host.categories.length > 0 || host.boundaries.length > 0 || host.localOnly) ? (
        <Section>
          <AppText variant="heading">Experience details</AppText>
          <View style={[styles.detailCard, { backgroundColor: theme.colors.surface }]}>
            {host.categories.length > 0 ? <Detail label="Interests" value={host.categories.join(', ')} /> : null}
            {host.boundaries.length > 0 ? <Detail label="Boundaries" value={host.boundaries.join(', ')} /> : null}
            {host.localOnly ? <Detail label="Languages" value={host.localOnly.languages.join(', ')} /> : null}
            {host.localOnly ? <Detail label="Response" value={host.localOnly.responseTime} /> : null}
            {host.localOnly ? <Detail label="Demo times" value={`${host.localOnly.availability.length} fixture examples`} /> : null}
            {host.rateLabel ? <Detail label="Rate" value={host.rateLabel} /> : null}
          </View>
        </Section>
      ) : null}

      <Section style={styles.bottomSection}>
        <ActionButton
          label={bookingAction.label}
          onPress={handleBookingAction}
          disabled={bookingDisabled}
          accessibilityHint={bookingAction.explanation}
        />
        <AppText variant="caption" color={theme.colors.textMuted} style={styles.actionExplanation}>
          {bookingAction.explanation}
        </AppText>
        <ActionButton label="Return to Explore" onPress={() => router.replace('/explore')} secondary />
      </Section>
    </Screen>
  )
}

function HostLoading() {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.state}>
      <AppText variant="label" color={theme.colors.social}>FRIEND HOST</AppText>
      <AppText variant="title">Loading public profile</AppText>
      <AppText color={theme.colors.textMuted}>Checking the approved host directory.</AppText>
    </Screen>
  )
}

function HostNotFound({ local = false }: { local?: boolean }) {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.state}>
      <AppText variant="title">Friend Host not found</AppText>
      <AppText color={theme.colors.textMuted}>
        {local ? 'This local demo profile may have moved.' : 'This public profile is not available.'}
      </AppText>
      <ActionButton label="Return to Explore" onPress={() => router.replace('/explore')} secondary />
    </Screen>
  )
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.state}>
      <AppText variant="label" color={theme.colors.social}>PROFILE UNAVAILABLE</AppText>
      <AppText variant="title">This Friend Host could not be loaded</AppText>
      <AppText color={theme.colors.textMuted}>This profile is temporarily unavailable. Please try again.</AppText>
      <ActionButton label="Try profile again" onPress={retry} secondary />
      <ActionButton label="Return to Explore" onPress={() => router.replace('/explore')} secondary />
    </Screen>
  )
}

function Metric({ value, label, accent }: { value: string; label: string; accent?: 'self' | 'social' }) {
  const theme = useAppTheme()
  return (
    <View style={styles.metric}>
      <AppText variant="bodyStrong" color={accent ? theme.colors[accent] : theme.colors.text}>{value}</AppText>
      <AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText>
    </View>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme()
  return (
    <View style={styles.detailRow}>
      <AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText>
      <AppText variant="bodyStrong" style={styles.detailValue}>{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: 64 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  navRow: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 48, height: 48, borderWidth: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  navSpacer: { width: 48 },
  pressed: { opacity: 0.68 },
  profileHero: { alignItems: 'center', paddingTop: 18, gap: 16 },
  profileCopy: { alignItems: 'center', gap: 2 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  verified: { width: 10, height: 10, borderRadius: 5 },
  tagline: { textAlign: 'center', marginTop: 22 },
  statusCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginTop: 22, gap: 6 },
  metrics: { minHeight: 78, borderTopWidth: 1, borderBottomWidth: 1, marginTop: 24, flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  metricDivider: { width: 1, height: 36 },
  sectionCopy: { marginTop: 12 },
  threadWrap: { marginTop: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  detailCard: { borderRadius: 20, padding: 16, marginTop: 14, gap: 15 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 },
  detailValue: { flex: 1, textAlign: 'right' },
  bottomSection: { marginTop: 40, gap: 12 },
  actionExplanation: { textAlign: 'center', marginBottom: 4 },
})

function goBackOrExplore() {
  if (router.canGoBack()) router.back()
  else router.replace('/explore')
}
