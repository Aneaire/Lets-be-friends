import { useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import { Alert, Pressable, StyleSheet, View } from 'react-native'

import { mobileApi, type CompanionProfileId } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { ActionButton } from '@/components/ActionButton'
import { Avatar } from '@/components/Avatar'
import { Chip } from '@/components/Chip'
import { Screen, Section } from '@/components/Screen'
import { TrustThread } from '@/components/TrustThread'
import { AppText } from '@/components/Typography'
import { getCompanion } from '@/data/companions'
import {
  mapApprovedCompanion,
  mapFixtureCompanion,
  mapPublicCompanion,
  resolveConnectedCompanion,
  resolveCompanionBookingAction,
  type ApprovedCompanionRecord,
  type CompanionDataSource,
  type CompanionDetailViewModel,
} from '@/data/companionViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function CompanionProfileScreen() {
  const params = useLocalSearchParams<{ id?: string; source?: CompanionDataSource }>()
  const configuration = useMobileBackendConfiguration()
  const id = typeof params.id === 'string' ? params.id : ''

  if (params.source === 'local_demo' || configuration.status !== 'configured') {
    const fixture = getCompanion(id)
    return fixture ? <CompanionDetail companion={mapFixtureCompanion(fixture)} /> : <CompanionNotFound local />
  }
  return <ConnectedCompanionDirectory id={id} />
}

function ConnectedCompanionDirectory({ id }: { id: string }) {
  const result = useQuery(mobileApi.companions.listApproved, {})
  if (result === undefined) return <CompanionLoading />

  const resolution = resolveConnectedCompanion(result as ApprovedCompanionRecord[], id)
  if (resolution.kind === 'not_found') return <CompanionNotFound />
  if (resolution.kind === 'demo') {
    const record = resolution.record
    return <CompanionDetail companion={{ ...mapApprovedCompanion(record), bio: record.bio, boundaries: record.boundaries ?? [] }} />
  }
  return <ConnectedCompanion record={resolution.record} />
}

function ConnectedCompanion({ record }: { record: ApprovedCompanionRecord }) {
  const result = useQuery(mobileApi.companions.getPublic, { companionProfileId: record._id as CompanionProfileId })
  if (result === undefined) return <CompanionLoading />
  if (result === null) return <CompanionNotFound />
  return <CompanionDetail companion={mapPublicCompanion(result as ApprovedCompanionRecord)} />
}

function CompanionDetail({ companion }: { companion: CompanionDetailViewModel }) {
  const theme = useAppTheme()
  const isLocalDemo = companion.source === 'local_demo'
  const isBackendDemo = companion.source === 'backend_demo'
  const modeLabels = companion.sessionModes.map((mode) => mode === 'online' ? 'Online' : 'In person')
  const bookingAction = resolveCompanionBookingAction(companion)
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
      router.push({ pathname: '/booking/new', params: { companionProfileId: companion.id } })
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
        <AppText variant="label" color={theme.colors.social}>COMPANION</AppText>
        <View style={styles.navSpacer} />
      </View>

      <View style={styles.profileHero}>
        <Avatar uri={companion.imageUrl} name={companion.name} size={116} />
        <View style={styles.profileCopy}>
          <View style={styles.verifiedRow}>
            <AppText variant="title">{companion.name}{companion.localOnly ? `, ${companion.localOnly.age}` : ''}</AppText>
            {companion.verified && <View accessibilityLabel="Identity verified" style={[styles.verified, { backgroundColor: theme.colors.self }]} />}
          </View>
          <AppText variant="caption" color={theme.colors.textMuted}>
            {[companion.localOnly?.pronouns, companion.location].filter(Boolean).join(' · ')}
          </AppText>
          {companion.distanceLabel ? <AppText variant="caption" color={theme.colors.textMuted}>{companion.distanceLabel}</AppText> : null}
        </View>
      </View>

      <AppText variant="heading" style={styles.tagline}>{companion.intro}</AppText>

      <View accessibilityLiveRegion="polite" style={[styles.statusCard, { backgroundColor: theme.colors.socialSoft, borderColor: theme.colors.social }]}>
        <AppText variant="label" color={theme.colors.social}>
          {isLocalDemo ? 'LOCAL DEMO PROFILE' : isBackendDemo ? 'EXAMPLE PROFILE' : companion.bookable ? 'PUBLIC PROFILE' : 'NOT BOOKABLE'}
        </AppText>
        <AppText variant="caption">
          {isLocalDemo
            ? 'This profile and its schedule are local fixture data. No booking request is sent.'
            : isBackendDemo
              ? 'This is an example profile provided by the service. It is not a live Companion profile and cannot be booked.'
              : companion.bookable
                ? bookingAction.explanation
                : 'This Companion is not accepting booking requests right now.'}
        </AppText>
      </View>

      <View style={[styles.metrics, { borderColor: theme.colors.border }]}>
        <Metric
          value={typeof companion.rating === 'number' ? `${companion.rating} ★` : 'New'}
          label={typeof companion.reviewCount === 'number' ? `${companion.reviewCount} reviews` : 'No rating shown'}
        />
        <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />
        <Metric value={modeLabels.join(' + ')} label="session format" />
        {companion.verified ? (
          <>
            <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />
            <Metric value="Verified" label="identity" accent="self" />
          </>
        ) : null}
      </View>

      {companion.bio ? (
        <Section>
          <AppText variant="heading">About this Companion</AppText>
          <AppText style={styles.sectionCopy} color={theme.colors.textMuted}>{companion.bio}</AppText>
        </Section>
      ) : null}

      <Section>
        <AppText variant="heading">Trust thread</AppText>
        <View style={styles.threadWrap}>
          <TrustThread items={[
            ...(companion.verified ? [{ title: 'Identity verified', detail: 'This approved public profile has a current identity approval.', tone: 'self' as const }] : []),
            { title: 'Strengths shared', detail: companion.strengths.join(' · '), tone: 'social' },
            { title: 'Session format', detail: modeLabels.join(' · '), tone: 'social' },
          ]} />
        </View>
      </Section>

      <Section>
        <AppText variant="heading">Strengths</AppText>
        <View style={styles.chips}>
          {companion.strengths.map((strength) => <Chip key={strength} label={strength} />)}
        </View>
      </Section>

      {(companion.categories.length > 0 || companion.boundaries.length > 0 || companion.localOnly) ? (
        <Section>
          <AppText variant="heading">Experience details</AppText>
          <View style={[styles.detailCard, { backgroundColor: theme.colors.surface }]}>
            {companion.categories.length > 0 ? <Detail label="Interests" value={companion.categories.join(', ')} /> : null}
            {companion.boundaries.length > 0 ? <Detail label="Boundaries" value={companion.boundaries.join(', ')} /> : null}
            {companion.localOnly ? <Detail label="Languages" value={companion.localOnly.languages.join(', ')} /> : null}
            {companion.localOnly ? <Detail label="Response" value={companion.localOnly.responseTime} /> : null}
            {companion.localOnly ? <Detail label="Demo times" value={`${companion.localOnly.availability.length} fixture examples`} /> : null}
            {companion.rateLabel ? <Detail label="Rate" value={companion.rateLabel} /> : null}
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

function CompanionLoading() {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.state}>
      <AppText variant="label" color={theme.colors.social}>COMPANION</AppText>
      <AppText variant="title">Loading public profile</AppText>
      <AppText color={theme.colors.textMuted}>Checking the approved companion directory.</AppText>
    </Screen>
  )
}

function CompanionNotFound({ local = false }: { local?: boolean }) {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.state}>
      <AppText variant="title">Companion not found</AppText>
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
      <AppText variant="title">This Companion could not be loaded</AppText>
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
