import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { mobileApi } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { Chip } from '@/design-system/atoms/Chip'
import { IconButton } from '@/design-system/atoms/IconButton'
import { CompanionCard } from '@/design-system/organisms/CompanionCard'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { SearchField } from '@/design-system/molecules/SearchField'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'
import { DiscoveryFilterSheet } from '@/features/discovery/DiscoveryFilterSheet'
import {
  activeDiscoveryFilterCount,
  defaultDiscoveryFilters,
  discoveryCategoryOptions,
  filterDiscoveryCompanions,
  includeUnavailableCompanions,
  type DiscoveryFilters,
} from '@/data/discovery'
import { mapApprovedCompanion, type ApprovedCompanionRecord } from '@/data/companionViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function ExploreScreen() {
  const configuration = useMobileBackendConfiguration()
  if (configuration.status !== 'configured') {
    return <ExploreState title="Discovery needs member services" detail="This build cannot connect to approved Companion profiles." />
  }
  return <ConnectedExploreScreen />
}

function ConnectedExploreScreen() {
  const result = useQuery(mobileApi.companions.listExploreDirectory, {})
  if (result === undefined) return <PageSkeleton variant="explore" />
  return <DiscoveryList sourceCompanions={(result as ApprovedCompanionRecord[]).map(mapApprovedCompanion)} />
}

function DiscoveryList({ sourceCompanions }: { sourceCompanions: ReturnType<typeof mapApprovedCompanion>[] }) {
  const theme = useAppTheme()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<DiscoveryFilters>(() => includeUnavailableCompanions(defaultDiscoveryFilters))
  const [filterSheet, setFilterSheet] = useState(false)
  const companions = useMemo(() => filterDiscoveryCompanions(sourceCompanions, query, filters), [filters, query, sourceCompanions])
  const categories = useMemo(() => discoveryCategoryOptions(sourceCompanions), [sourceCompanions])
  const unavailableMatches = useMemo(() => filterDiscoveryCompanions(sourceCompanions, query, includeUnavailableCompanions(filters)), [filters, query, sourceCompanions])
  const liveCount = sourceCompanions.length
  const canIncludeUnavailable = filters.bookableOnly && companions.length === 0 && unavailableMatches.length > 0

  function clearFilters() {
    setQuery('')
    setFilters(includeUnavailableCompanions(defaultDiscoveryFilters))
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <FlatList
        data={companions}
        keyExtractor={(companion) => companion.id}
        renderItem={({ item }) => <CompanionCard companion={item} />}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <AppText variant="title">Explore people</AppText>
                <AppText color={theme.colors.textMuted}>Meet members and find Companions by Strength, category, and session format.</AppText>
              </View>
              <IconButton
                label="Open nearby discovery"
                icon="map-outline"
                tone="social"
                onPress={() => router.push('/nearby' as never)}
                style={{ ...styles.nearbyButton, borderColor: theme.colors.socialText }}
              />
            </View>
            <SearchField label="Search people" value={query} onChange={setQuery} placeholder="Search names, Strengths, or interests" />
            <View style={styles.quickFilters}>
              <Chip label={filters.bookableOnly ? 'Bookable only' : 'Include unavailable'} selected={filters.bookableOnly} onPress={() => setFilters((current) => ({ ...current, bookableOnly: !current.bookableOnly }))} />
              <Chip label={`Filters ${activeDiscoveryFilterCount(filters)}`} selected={Boolean(filters.category || filters.strength || filters.mode !== 'all')} onPress={() => setFilterSheet(true)} />
            </View>
            <View style={styles.resultRow}>
              <AppText variant="bodyStrong">{companions.length} {companions.length === 1 ? 'person' : 'people'}</AppText>
              {query || activeDiscoveryFilterCount(filters) > 1 || !filters.bookableOnly ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear discovery filters" onPress={clearFilters} style={styles.clearButton}><AppText variant="caption" color={theme.colors.socialText}>Clear</AppText></Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <StateView
            embedded
            title={liveCount === 0 ? 'No members yet' : 'No matches for these filters'}
            detail={liveCount === 0 ? 'No member profiles are available yet. Check back soon.' : canIncludeUnavailable ? 'Some matching Companions are not accepting booking requests right now.' : 'Try another category, Strength, or session format.'}
            actionLabel={liveCount === 0 ? undefined : canIncludeUnavailable ? 'Include unavailable Companions' : 'Clear filters'}
            onAction={liveCount === 0 ? undefined : canIncludeUnavailable ? () => setFilters((current) => includeUnavailableCompanions(current)) : clearFilters}
          />
        }
      />
      <DiscoveryFilterSheet visible={filterSheet} filters={filters} categories={categories} onChange={setFilters} onClose={() => setFilterSheet(false)} />
    </SafeAreaView>
  )
}

function ExploreState({ title, detail, loading = false }: { title: string; detail?: string; loading?: boolean }) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="EXPLORE" title={title} detail={detail} loading={loading} /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="EXPLORE" title="Companions could not be loaded" detail="Discovery is temporarily unavailable." actionLabel="Try again" onAction={retry} /></Screen>
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  state: { paddingHorizontal: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { paddingTop: 14, gap: 12, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleCopy: { flex: 1, gap: 4 },
  nearbyButton: { width: 48, height: 48, borderWidth: 1, borderRadius: 24 },
  quickFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearButton: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  gap: { height: 6 },
})
