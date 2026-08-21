import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { mobileApi } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { ActionButton } from '@/components/ActionButton'
import { Chip } from '@/components/Chip'
import { CompanionCard } from '@/components/CompanionCard'
import { Screen } from '@/components/Screen'
import { StateView } from '@/components/StateView'
import { AppText } from '@/components/Typography'
import {
  activeDiscoveryFilterCount,
  defaultDiscoveryFilters,
  discoveryCategories,
  discoveryModes,
  discoveryStrengths,
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
  if (result === undefined) return <ExploreState title="Loading members" detail="Connecting to the member directory." loading />
  return <DiscoveryList sourceCompanions={(result as ApprovedCompanionRecord[]).map(mapApprovedCompanion)} />
}

function DiscoveryList({ sourceCompanions }: { sourceCompanions: ReturnType<typeof mapApprovedCompanion>[] }) {
  const theme = useAppTheme()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<DiscoveryFilters>(() => includeUnavailableCompanions(defaultDiscoveryFilters))
  const [filterSheet, setFilterSheet] = useState(false)
  const companions = useMemo(() => filterDiscoveryCompanions(sourceCompanions, query, filters), [filters, query, sourceCompanions])
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
              <Pressable accessibilityRole="button" accessibilityLabel="Open nearby discovery" onPress={() => router.push('/nearby' as never)} style={styles.nearbyButton}>
                <AppText variant="label" color={theme.colors.socialText}>NEARBY</AppText>
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel="Search people"
              placeholder="Search names, Strengths, or interests"
              placeholderTextColor={theme.colors.textMuted}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              style={[styles.search, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}
            />
            <View style={styles.quickFilters}>
              <Chip label={filters.bookableOnly ? 'Bookable only' : 'Include unavailable'} selected={filters.bookableOnly} onPress={() => setFilters((current) => ({ ...current, bookableOnly: !current.bookableOnly }))} />
              <Chip label={`Filters ${activeDiscoveryFilterCount(filters)}`} selected={Boolean(filters.category || filters.strength || filters.mode !== 'all')} onPress={() => setFilterSheet(true)} />
            </View>
            <View style={styles.resultRow}>
              <AppText variant="bodyStrong">{companions.length} {companions.length === 1 ? 'Companion' : 'Companions'}</AppText>
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
      <FilterSheet visible={filterSheet} filters={filters} onChange={setFilters} onClose={() => setFilterSheet(false)} />
    </SafeAreaView>
  )
}

function FilterSheet({ visible, filters, onChange, onClose }: { visible: boolean; filters: DiscoveryFilters; onChange: (filters: DiscoveryFilters) => void; onClose: () => void }) {
  const theme = useAppTheme()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
          <View style={styles.sheetHeader}><AppText variant="heading">Discovery filters</AppText><Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={onClose} style={styles.close}><AppText variant="heading">×</AppText></Pressable></View>
          <AppText variant="bodyStrong">Session format</AppText>
          <View style={styles.chips}>{discoveryModes.map((mode) => <Chip key={mode.id} label={mode.label} selected={filters.mode === mode.id} onPress={() => onChange({ ...filters, mode: mode.id })} />)}</View>
          <AppText variant="bodyStrong">Everyday help and activities</AppText>
          <FlatList horizontal data={discoveryCategories} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips} renderItem={({ item }) => <Chip label={item} selected={filters.category === item} onPress={() => onChange({ ...filters, category: filters.category === item ? undefined : item })} />} />
          <AppText variant="bodyStrong">Strength</AppText>
          <FlatList horizontal data={discoveryStrengths} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips} renderItem={({ item }) => <Chip label={item} selected={filters.strength === item} onPress={() => onChange({ ...filters, strength: filters.strength === item ? undefined : item })} />} />
          <ActionButton label="Show results" onPress={onClose} />
          <ActionButton label="Reset filters" onPress={() => onChange(includeUnavailableCompanions(defaultDiscoveryFilters))} secondary />
        </View>
      </View>
    </Modal>
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
  list: { paddingHorizontal: 16, paddingBottom: 44 },
  header: { paddingTop: 14, gap: 12, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleCopy: { flex: 1, gap: 4 },
  nearbyButton: { minWidth: 64, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
  quickFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearButton: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  gap: { height: 8 },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderWidth: 1, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28, gap: 12, maxHeight: '82%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  horizontalChips: { gap: 8, paddingRight: 16 },
})
