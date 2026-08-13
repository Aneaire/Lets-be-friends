import { useQuery } from 'convex/react'
import type { ErrorBoundaryProps } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { mobileApi } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { ActionButton } from '@/components/ActionButton'
import { Chip } from '@/components/Chip'
import { CompanionCard } from '@/components/CompanionCard'
import { Screen } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import { discoveryFilters, filterDiscoveryCompanions, fixtureDiscoveryCompanions, type DiscoveryFilter } from '@/data/discovery'
import { mapApprovedCompanion, type ApprovedCompanionRecord, type DiscoveryCompanionViewModel } from '@/data/companionViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function ExploreScreen() {
  const configuration = useMobileBackendConfiguration()

  if (configuration.status === 'configured') return <ConnectedExploreScreen />
  return (
    <DiscoveryList
      sourceCompanions={fixtureDiscoveryCompanions}
      notice="You are viewing example profiles stored on this device. They are not live profiles and cannot be booked."
    />
  )
}

function ConnectedExploreScreen() {
  const result = useQuery(mobileApi.companions.listApproved, {})
  if (result === undefined) return <DiscoveryLoading />

  const companions = (result as ApprovedCompanionRecord[]).map(mapApprovedCompanion)
  const hasBackendDemoCompanions = companions.some((companion) => companion.source === 'backend_demo')
  return (
    <DiscoveryList
      sourceCompanions={companions}
      notice={hasBackendDemoCompanions
        ? 'This is an example profile provided by the service. It is not a live Companion profile and cannot be booked.'
        : 'Showing live approved Companions. Session availability is not shown.'}
    />
  )
}

function DiscoveryList({ sourceCompanions, notice }: { sourceCompanions: DiscoveryCompanionViewModel[]; notice: string }) {
  const theme = useAppTheme()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DiscoveryFilter>('all')
  const companions = useMemo(() => filterDiscoveryCompanions(sourceCompanions, query, filter), [filter, query, sourceCompanions])

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <FlatList
        data={companions}
        keyExtractor={(companion) => `${companion.source}:${companion.id}`}
        renderItem={({ item }) => <CompanionCard companion={item} />}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="label" color={theme.colors.social}>DISCOVERY</AppText>
            <AppText variant="display">Find your kind of company.</AppText>
            <AppText color={theme.colors.textMuted}>
              Browse Companions by Strengths, interests, and session format.
            </AppText>
            <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: theme.colors.socialSoft, borderColor: theme.colors.social }]}>
              <AppText variant="caption" color={theme.colors.text}>{notice}</AppText>
            </View>
            <TextInput
              accessibilityLabel="Search Companions"
              placeholder="Search Strengths, places, or interests"
              placeholderTextColor={theme.colors.textMuted}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              style={[
                styles.search,
                theme.typography.body,
                { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            />
            <FlatList
              horizontal
              data={discoveryFilters}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Chip label={item.label} selected={filter === item.id} onPress={() => setFilter(item.id)} />
              )}
              ItemSeparatorComponent={() => <View style={styles.filterGap} />}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            />
            <View style={styles.resultRow}>
              <AppText variant="heading">Companions</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>{companions.length} matches</AppText>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: theme.colors.border }]}>
            <AppText variant="heading">No close matches yet</AppText>
            <AppText color={theme.colors.textMuted}>
              {sourceCompanions.length === 0 ? 'No approved Companions are available right now.' : 'Try another Strength or include every session format.'}
            </AppText>
            {(query || filter !== 'all') && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear discovery filters"
                onPress={() => { setQuery(''); setFilter('all') }}
                style={styles.clearButton}>
                <AppText variant="label" color={theme.colors.social}>CLEAR FILTERS</AppText>
              </Pressable>
            )}
          </View>
        }
      />
    </SafeAreaView>
  )
}

function DiscoveryLoading() {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.state}>
      <AppText variant="label" color={theme.colors.social}>DISCOVERY</AppText>
      <AppText variant="title">Loading Companions</AppText>
      <AppText color={theme.colors.textMuted}>Connecting to the public companion directory.</AppText>
    </Screen>
  )
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.state}>
      <AppText variant="label" color={theme.colors.social}>DISCOVERY UNAVAILABLE</AppText>
      <AppText variant="title">Companions could not be loaded</AppText>
      <AppText color={theme.colors.textMuted}>Companions are temporarily unavailable. Please try again.</AppText>
      <ActionButton label="Try discovery again" onPress={retry} secondary />
    </Screen>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 44 },
  header: { paddingTop: 14, gap: 14 },
  notice: { borderWidth: 1, borderRadius: 16, padding: 14 },
  search: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, marginTop: 4 },
  filters: { paddingVertical: 4 },
  filterGap: { width: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, marginBottom: 16 },
  gap: { height: 14 },
  empty: { borderWidth: 1, borderRadius: 24, padding: 24, gap: 10 },
  clearButton: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
})
