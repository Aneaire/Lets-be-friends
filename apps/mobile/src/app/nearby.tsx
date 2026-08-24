import * as Location from 'expo-location'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { mobileApi } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { SearchField } from '@/design-system/molecules/SearchField'
import { Chip } from '@/design-system/atoms/Chip'
import { CompanionCard } from '@/design-system/organisms/CompanionCard'
import { ProductMap } from '@/design-system/organisms/ProductMap'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'
import { mapApprovedCompanion, type ApprovedCompanionRecord } from '@/data/companionViewModels'
import { defaultDiscoveryFilters, discoveryCategories, discoveryModes, discoveryStrengths, filterDiscoveryCompanions, type DiscoveryFilters } from '@/data/discovery'
import { useAppTheme } from '@/theme/ThemeProvider'

const radii = [5, 10, 25, 50, 100] as const
type Radius = typeof radii[number]

export default function NearbyScreen() {
  const backend = useMobileBackendConfiguration()
  const theme = useAppTheme()
  const [radiusKm, setRadiusKm] = useState<Radius>(25)
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [originLabel, setOriginLabel] = useState('Current area')
  const [travelArea, setTravelArea] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<DiscoveryFilters>(defaultDiscoveryFilters)
  const result = useQuery(mobileApi.companions.listApproved, backend.status === 'configured' && origin ? { ...origin, radiusKm } : 'skip')
  const companions = useMemo(() => {
    const source = (result ?? []).map((record: ApprovedCompanionRecord) => mapApprovedCompanion(record))
    return filterDiscoveryCompanions(source, query, filters)
  }, [filters, query, result])

  async function locate() {
    setLocating(true)
    setLocationError('')
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        setLocationError('Foreground location permission is needed to search nearby. You can continue using regular Explore without it.')
        return
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setOrigin(roundOrigin(position.coords))
      setOriginLabel('Current area')
    } catch {
      setLocationError('Your current location could not be read. Try again outdoors or continue with regular Explore.')
    } finally {
      setLocating(false)
    }
  }

  async function locateTravelArea() {
    const area = travelArea.trim()
    if (area.length < 2) { setLocationError('Enter a city, neighborhood, or landmark.'); return }
    setLocating(true)
    setLocationError('')
    try {
      const matches = await Location.geocodeAsync(area)
      if (!matches[0]) { setLocationError('That travel area could not be found. Try a city and province.'); return }
      setOrigin(roundOrigin(matches[0]))
      setOriginLabel(area)
    } catch { setLocationError('That travel area could not be searched. Please try again.') } finally { setLocating(false) }
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
        <ScrollView contentContainerStyle={styles.prompt} showsVerticalScrollIndicator={false}>
          <ProductMap />
          <AppText variant="title">Find Companions near you</AppText>
          <AppText color={theme.colors.textMuted}>Your foreground location is sent only for this radius search. Results use approximate Companion locations and distances, not precise meeting locations.</AppText>
          {locationError ? <AppText accessibilityRole="alert" color={theme.colors.danger}>{locationError}</AppText> : null}
          <ActionButton label={locating ? 'Finding your location' : 'Use current location'} onPress={() => void locate()} disabled={locating} />
          <View style={styles.orRow}><View style={[styles.orLine, { backgroundColor: theme.colors.border }]} /><AppText variant="caption" color={theme.colors.textMuted}>OR SEARCH A TRAVEL AREA</AppText><View style={[styles.orLine, { backgroundColor: theme.colors.border }]} /></View>
          <SearchField label="Travel area" value={travelArea} onChange={setTravelArea} placeholder="City, neighborhood, or landmark" autoCapitalize="words" onSubmitEditing={() => void locateTravelArea()} />
          <ActionButton label={locating ? 'Searching area' : 'Search travel area'} onPress={() => void locateTravelArea()} secondary disabled={locating || travelArea.trim().length < 2} />
          <ActionButton label="Return to Explore" onPress={() => router.replace('/explore')} secondary />
        </ScrollView>
      ) : (
        <FlatList
          data={companions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CompanionCard companion={item} />}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<View style={styles.listHeader}>
            <ProductMap center={origin} radiusKm={radiusKm} points={mapPoints} onSelectPoint={openCompanion} />
            <AppText variant="bodyStrong">Around {originLabel}</AppText>
            <AppText color={theme.colors.textMuted}>The map and results use rounded search and Companion areas. Exact addresses are never shown.</AppText>
            <View style={styles.radii}>{radii.map((radius) => <Chip key={radius} label={`${radius} km`} selected={radiusKm === radius} onPress={() => setRadiusKm(radius)} />)}</View>
            <SearchField label="Search nearby Companions" value={query} onChange={setQuery} placeholder="Search names, Strengths, or interests" />
            <View style={styles.radii}>{discoveryModes.map((item) => <Chip key={item.id} label={item.label} selected={filters.mode === item.id} onPress={() => setFilters((current) => ({ ...current, mode: item.id }))} />)}<Chip label="Bookable" selected={filters.bookableOnly} onPress={() => setFilters((current) => ({ ...current, bookableOnly: !current.bookableOnly }))} /></View>
            <FlatList horizontal data={discoveryCategories} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal} renderItem={({ item }) => <Chip label={item} selected={filters.category === item} onPress={() => setFilters((current) => ({ ...current, category: current.category === item ? undefined : item }))} />} />
            <FlatList horizontal data={discoveryStrengths} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal} renderItem={({ item }) => <Chip label={item} selected={filters.strength === item} onPress={() => setFilters((current) => ({ ...current, strength: current.strength === item ? undefined : item }))} />} />
            <ActionButton label="Refresh current location" onPress={() => void locate()} secondary disabled={locating} />
            <AppText variant="bodyStrong">{result === undefined ? 'Loading nearby results' : `${companions.length} nearby ${companions.length === 1 ? 'Companion' : 'Companions'}`}</AppText>
          </View>}
          ListEmptyComponent={result === undefined ? null : <StateView embedded title="No live Companions in this radius" detail="Try a larger radius or return to Explore for online sessions." />}
        />
      )}
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

function roundOrigin(origin: { latitude: number; longitude: number }) { return { latitude: Math.round(origin.latitude * 100) / 100, longitude: Math.round(origin.longitude * 100) / 100 } }

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerWrap: { paddingHorizontal: 16 },
  prompt: { flexGrow: 1, justifyContent: 'center', padding: 14, gap: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  listHeader: { gap: 12, paddingVertical: 14 },
  radii: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orLine: { height: 1, flex: 1 },
  horizontal: { gap: 8, paddingRight: 16 },
  gap: { height: 8 },
})
