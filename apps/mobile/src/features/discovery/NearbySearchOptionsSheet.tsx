import { FlatList, StyleSheet, View } from 'react-native'
import { allActivityCategoryLabel } from '@lets-be-friends/shared'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Chip } from '@/design-system/atoms/Chip'
import { AppText } from '@/design-system/atoms/Typography'
import { BottomSheet } from '@/design-system/molecules/BottomSheet'
import { SearchField } from '@/design-system/molecules/SearchField'
import { discoveryModes, discoveryStrengths, type DiscoveryFilters } from '@/data/discovery'
import { density } from '@/theme/tokens'

export const nearbyRadiusOptions = [5, 10, 25, 50, 100] as const
export type NearbyRadius = typeof nearbyRadiusOptions[number]

type NearbySearchOptionsSheetProps = {
  visible: boolean
  radiusKm: NearbyRadius
  query: string
  filters: DiscoveryFilters
  categories: readonly string[]
  locating: boolean
  resultCount: number | null
  onRadiusChange: (radius: NearbyRadius) => void
  onQueryChange: (query: string) => void
  onFiltersChange: (filters: DiscoveryFilters) => void
  onRefreshLocation: () => void
  onClose: () => void
}

export function NearbySearchOptionsSheet({
  visible,
  radiusKm,
  query,
  filters,
  categories,
  locating,
  resultCount,
  onRadiusChange,
  onQueryChange,
  onFiltersChange,
  onRefreshLocation,
  onClose,
}: NearbySearchOptionsSheetProps) {
  const resultLabel = resultCount === null
    ? 'Show results'
    : `Show ${resultCount} ${resultCount === 1 ? 'Companion' : 'Companions'}`

  return (
    <BottomSheet
      visible={visible}
      title="Nearby search options"
      description="Adjust the area and the Companions shown on the map."
      closeLabel="Close nearby search options"
      onClose={onClose}
      footer={<ActionButton label={resultLabel} onPress={onClose} />}>
      <View style={styles.body}>
        <AppText variant="bodyStrong">Search radius</AppText>
        <View style={styles.chips}>
          {nearbyRadiusOptions.map((radius) => (
            <Chip
              key={radius}
              label={`${radius} km`}
              selected={radiusKm === radius}
              onPress={() => onRadiusChange(radius)}
            />
          ))}
        </View>

        <SearchField
          label="Search nearby Companions"
          value={query}
          onChange={onQueryChange}
          placeholder="Search names, Strengths, or interests"
        />

        <AppText variant="bodyStrong">Session format</AppText>
        <View style={styles.chips}>
          {discoveryModes.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              selected={filters.mode === item.id}
              onPress={() => onFiltersChange({ ...filters, mode: item.id })}
            />
          ))}
          <Chip
            label="Bookable"
            selected={filters.bookableOnly}
            onPress={() => onFiltersChange({ ...filters, bookableOnly: !filters.bookableOnly })}
          />
        </View>

        <AppText variant="bodyStrong">Everyday help and activities</AppText>
        <FlatList
          horizontal
          data={[allActivityCategoryLabel, ...categories]}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalChips}
          renderItem={({ item }) => (
            <Chip
              label={item}
              selected={item === allActivityCategoryLabel ? !filters.category : filters.category === item}
              onPress={() => onFiltersChange({
                ...filters,
                category: item === allActivityCategoryLabel || filters.category === item ? undefined : item,
              })}
            />
          )}
        />

        <AppText variant="bodyStrong">Strength</AppText>
        <FlatList
          horizontal
          data={discoveryStrengths}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalChips}
          renderItem={({ item }) => (
            <Chip
              label={item}
              selected={filters.strength === item}
              onPress={() => onFiltersChange({
                ...filters,
                strength: filters.strength === item ? undefined : item,
              })}
            />
          )}
        />

        <ActionButton
          label={locating ? 'Finding your location' : 'Refresh current location'}
          icon="locate-outline"
          onPress={onRefreshLocation}
          secondary
          disabled={locating}
        />
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: density.compactCardPadding },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: density.cardGap },
  horizontalChips: { gap: density.cardGap, paddingRight: density.sheetPadding },
})
