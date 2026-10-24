import * as Location from 'expo-location'
import { useMutation, useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { FlatList, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { mobileApi } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { IconButton } from '@/design-system/atoms/IconButton'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { SearchField } from '@/design-system/molecules/SearchField'
import { CompanionCard } from '@/design-system/organisms/CompanionCard'
import { ProductMap } from '@/design-system/organisms/ProductMap'
import { ListRowsSkeleton } from '@/design-system/templates/PageSkeleton'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'
import { mapApprovedCompanion, type ApprovedCompanionRecord } from '@/data/companionViewModels'
import { defaultDiscoveryFilters, discoveryCategoryOptions, filterDiscoveryCompanions, nearbySearchOptionsLabel, type DiscoveryFilters } from '@/data/discovery'
import { NearbySearchOptionsSheet, type NearbyRadius } from '@/features/discovery/NearbySearchOptionsSheet'
import { readCurrentCoordinates } from '@/features/discovery/nearbyLocation'
import { NearbyAccountRequestScope, normalizeMapCoordinates, roundOriginCoordinates } from '@/features/discovery/nearbyOrigin'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function NearbyScreen() {
  const backend = useMobileBackendConfiguration()
  const theme = useAppTheme()
  const member = useMobileMember()
  const updateApproximateLocation = useMutation(mobileApi.users.updateApproximateLocation)
  const [radiusKm, setRadiusKm] = useState<NearbyRadius>(25)
  const [mapInteracting, setMapInteracting] = useState(false)
  const [overrideOrigin, setOverrideOrigin] = useState<{ latitude: number; longitude: number } | null>(null)
  const [pinMode, setPinMode] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [locationNotice, setLocationNotice] = useState('')
  useAppToastMessage(locationNotice)
  const consentedSavedOrigin =
    member.status === 'ready' &&
    typeof member.viewer.approximateLatitude === 'number' &&
    typeof member.viewer.approximateLongitude === 'number' &&
    member.viewer.approximateLocationConsentedAt !== undefined &&
    member.viewer.approximateLocationConsentedAt !== null
      ? { latitude: member.viewer.approximateLatitude, longitude: member.viewer.approximateLongitude }
      : null
  const memberKey = member.status === 'ready' ? String(member.viewer._id) : null
  const accountScope = useMemo(() => new NearbyAccountRequestScope(), [])
  useEffect(() => {
    accountScope.switchMember(memberKey)
    setOverrideOrigin(null)
    setPinMode(false)
    setLocating(false)
    setLocationError('')
    setLocationNotice('')
    setOriginLabel('Saved area')
    setTravelArea('')
  }, [accountScope, memberKey])
  // Consented saved coordinates are the default search center: no GPS prompt,
  // no foreground fix. Explicit choices override them for this screen only.
  const origin = overrideOrigin ?? consentedSavedOrigin
  const [originLabel, setOriginLabel] = useState('Saved area')
  const [travelArea, setTravelArea] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<DiscoveryFilters>(defaultDiscoveryFilters)
  const [optionsVisible, setOptionsVisible] = useState(false)
  const result = useQuery(mobileApi.companions.listApproved, backend.status === 'configured' && origin ? { ...origin, radiusKm } : 'skip')
  const sourceCompanions = useMemo(
    () => (result ?? []).map((record: ApprovedCompanionRecord) => mapApprovedCompanion(record)),
    [result],
  )
  const companions = useMemo(
    () => filterDiscoveryCompanions(sourceCompanions, query, filters),
    [filters, query, sourceCompanions],
  )
  const categories = useMemo(() => discoveryCategoryOptions(sourceCompanions), [sourceCompanions])

  async function locate() {
    const request = accountScope.begin()
    setLocating(true)
    setLocationError('')
    setLocationNotice('')
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!request.isCurrent()) return
      if (!permission.granted) {
        setLocationError('Foreground location permission is needed to search nearby. You can continue using regular Explore without it.')
        return
      }
      const coordinates = await readCurrentCoordinates(() => (
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      ))
      if (!request.isCurrent()) return
      const canSave =
        member.status === 'ready' &&
        member.viewer.approximateLocationConsentedAt !== undefined &&
        member.viewer.approximateLocationConsentedAt !== null
      if (canSave) {
        try {
          const saved = await updateApproximateLocation({ latitude: coordinates.latitude, longitude: coordinates.longitude })
          if (!request.isCurrent()) return
          setOverrideOrigin({ latitude: saved.latitude, longitude: saved.longitude })
          setOriginLabel('Saved area')
          setLocationNotice('Your current area was saved as your approximate location and is now the nearby search center.')
          return
        } catch {
          if (!request.isCurrent()) return
        }
      }
      setOverrideOrigin(roundOriginCoordinates(coordinates))
      setOriginLabel(canSave ? 'Current area' : 'Current area (not saved)')
      if (canSave) {
        setLocationNotice('Showing nearby from this device. Your saved approximate area could not be updated.')
      } else {
        setLocationNotice('This device fix is used only for this search. Agree to store your approximate location during onboarding to save an area.')
      }
    } catch {
      if (!request.isCurrent()) return
      setLocationError('Your current location could not be read. Try again outdoors or continue with regular Explore.')
    } finally {
      if (request.isCurrent()) setLocating(false)
    }
  }

  async function locateTravelArea() {
    const request = accountScope.begin()
    const area = travelArea.trim()
    if (area.length < 2) { setLocationError('Enter a city, neighborhood, or landmark.'); return }
    setLocating(true)
    setLocationError('')
    try {
      const matches = await Location.geocodeAsync(area)
      if (!request.isCurrent()) return
      if (!matches[0]) { setLocationError('That travel area could not be found. Try a city and province.'); return }
      setOverrideOrigin(roundOriginCoordinates(matches[0]))
      setOriginLabel(area)
    } catch {
      if (request.isCurrent()) setLocationError('That travel area could not be searched. Please try again.')
    } finally { if (request.isCurrent()) setLocating(false) }
  }

  function handlePickLocation(coords: { latitude: number; longitude: number }) {
    const picked = normalizeMapCoordinates(coords)
    if (!picked) return
    setOverrideOrigin(roundOriginCoordinates(picked))
    setOriginLabel('Placed pin')
    setLocationError('')
    setPinMode(false)
  }

  if (backend.status !== 'configured') {
    return <NearbyShell><StateView title="Nearby discovery is unavailable" detail="This build cannot connect to nearby discovery." /></NearbyShell>
  }

  const mapPoints = companions.flatMap((companion) => (
    typeof companion.latitude === 'number' && typeof companion.longitude === 'number'
      ? [{ id: companion.id, latitude: companion.latitude, longitude: companion.longitude, name: companion.name }]
      : []
  ))
  const openCompanion = (id: string) => router.push({ pathname: '/companion-profile/[id]', params: { id } })

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.headerWrap}><AppHeader title="Nearby Companions" subtitle="Approximate results only" back onBack={() => goBack()} /></View>
      {!origin ? (
        <ScrollView contentContainerStyle={styles.prompt} showsVerticalScrollIndicator={false} scrollEnabled={!mapInteracting}>
          {pinMode ? (
            <>
              <View style={styles.pinMap}>
                <ProductMap onPickLocation={(coords) => handlePickLocation(coords)} onInteractionChange={setMapInteracting} pinMode radiusKm={radiusKm} />
              </View>
              <AppText variant="title">Place a search pin</AppText>
              <AppText color={theme.colors.textMuted}>Tap the map to set the center of your nearby search. The map uses approximate areas, not precise meeting locations.</AppText>
              <ActionButton label="Cancel pin placement" onPress={() => { setPinMode(false); setLocationError('') }} secondary />
            </>
          ) : (
            <>
              <ProductMap onInteractionChange={setMapInteracting} />
              <AppText variant="title">Find Companions near you</AppText>
              {consentedSavedOrigin ? (
                <AppText color={theme.colors.textMuted}>Searching from your saved approximate area. No foreground location is needed. Use your current location below to move the saved area.</AppText>
              ) : (
                <AppText color={theme.colors.textMuted}>Your foreground location is sent only for this radius search. Results use approximate Companion locations and distances, not precise meeting locations.</AppText>
              )}
              {locationError ? <AppText accessibilityRole="alert" color={theme.colors.danger}>{locationError}</AppText> : null}
              <ActionButton label={locating ? 'Finding your location' : 'Use current location'} onPress={() => void locate()} disabled={locating} />
              <View style={styles.orRow}><View style={[styles.orLine, { backgroundColor: theme.colors.border }]} /><AppText variant="caption" color={theme.colors.textMuted}>OR SEARCH A TRAVEL AREA</AppText><View style={[styles.orLine, { backgroundColor: theme.colors.border }]} /></View>
              <SearchField label="Travel area" value={travelArea} onChange={setTravelArea} placeholder="City, neighborhood, or landmark" autoCapitalize="words" onSubmitEditing={() => void locateTravelArea()} />
              <ActionButton label={locating ? 'Searching area' : 'Search travel area'} onPress={() => void locateTravelArea()} secondary disabled={locating || travelArea.trim().length < 2} />
              <ActionButton label="Place a pin on the map" onPress={() => { setPinMode(true); setLocationError('') }} secondary />
              <ActionButton label="Return to Explore" onPress={() => router.replace('/explore')} secondary />
            </>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={companions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CompanionCard companion={item} />}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          contentContainerStyle={styles.list}
          scrollEnabled={!mapInteracting}
          ListHeaderComponent={<View style={styles.listHeader}>
            <ProductMap center={origin} radiusKm={radiusKm} points={mapPoints} onSelectPoint={openCompanion} onInteractionChange={setMapInteracting} expanded />
            <View style={styles.mapSummary}>
              <View style={styles.mapSummaryCopy}>
                <AppText variant="bodyStrong">Around {originLabel}</AppText>
                <AppText variant="caption" color={theme.colors.textMuted}>Within {radiusKm} km. Approximate areas only.</AppText>
              </View>
              <IconButton
                label={nearbySearchOptionsLabel(radiusKm, query, filters)}
                icon="options-outline"
                tone="social"
                onPress={() => setOptionsVisible(true)}
                style={{ ...styles.optionsButton, borderColor: theme.colors.socialText }}
              />
            </View>
            <AppText color={theme.colors.textMuted}>The map and results use rounded search and Companion areas. Exact addresses are never shown.</AppText>
            <AppText variant="bodyStrong">{result === undefined ? 'Loading nearby results' : `${companions.length} nearby ${companions.length === 1 ? 'Companion' : 'Companions'}`}</AppText>
          </View>}
          ListEmptyComponent={result === undefined ? <ListRowsSkeleton count={3} /> : <StateView embedded title="No live Companions in this radius" detail="Try a larger radius or return to Explore for online sessions." />}
        />
      )}
      <NearbySearchOptionsSheet
        visible={optionsVisible}
        radiusKm={radiusKm}
        query={query}
        filters={filters}
        categories={categories}
        locating={locating}
        resultCount={result === undefined ? null : companions.length}
        onRadiusChange={setRadiusKm}
        onQueryChange={setQuery}
        onFiltersChange={setFilters}
        onRefreshLocation={() => void locate()}
        onClose={() => setOptionsVisible(false)}
      />
    </SafeAreaView>
  )
}

function NearbyShell({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme()
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}><View style={styles.headerWrap}><AppHeader title="Nearby Companions" back onBack={() => goBack()} /></View><View style={styles.prompt}>{children}</View></SafeAreaView>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <NearbyShell><StateView title="Nearby discovery is temporarily unavailable" detail="No location or booking action was saved." actionLabel="Try again" onAction={retry} /></NearbyShell>
}

function goBack() {
  if (router.canGoBack()) router.back()
  else router.replace('/explore')
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerWrap: { paddingHorizontal: 16 },
  prompt: { flexGrow: 1, justifyContent: 'center', padding: 14, gap: 16 },
  pinMap: { height: 380, borderRadius: 18, overflow: 'hidden' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  listHeader: { gap: 12, paddingVertical: 14 },
  mapSummary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mapSummaryCopy: { flex: 1, minWidth: 0, gap: 2 },
  optionsButton: { width: 48, height: 48, borderWidth: 1, borderRadius: 24 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orLine: { height: 1, flex: 1 },
  gap: { height: 8 },
})
