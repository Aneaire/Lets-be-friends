import { FlatList, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Chip } from '@/design-system/atoms/Chip'
import { AppText } from '@/design-system/atoms/Typography'
import { BottomSheet, BottomSheetPresentation } from '@/design-system/molecules/BottomSheet'
import { defaultDiscoveryFilters, discoveryCategories, discoveryModes, discoveryStrengths, includeUnavailableCompanions, type DiscoveryFilters } from '@/data/discovery'
import { density } from '@/theme/tokens'

type DiscoveryFilterSheetContentProps = {
  filters: DiscoveryFilters
  onChange: (filters: DiscoveryFilters) => void
  onClose: () => void
}

export type DiscoveryFilterSheetProps = DiscoveryFilterSheetContentProps & {
  visible: boolean
}

export type DiscoveryFilterSheetPresentationProps = DiscoveryFilterSheetContentProps

function FilterBody({ filters, onChange }: Pick<DiscoveryFilterSheetContentProps, 'filters' | 'onChange'>) {
  return (
    <View style={styles.body}>
      <AppText variant="bodyStrong">Session format</AppText>
      <View style={styles.chips}>
        {discoveryModes.map((mode) => (
          <Chip key={mode.id} label={mode.label} selected={filters.mode === mode.id} onPress={() => onChange({ ...filters, mode: mode.id })} />
        ))}
      </View>
      <AppText variant="bodyStrong">Everyday help and activities</AppText>
      <FlatList
        horizontal
        data={discoveryCategories}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalChips}
        renderItem={({ item }) => <Chip label={item} selected={filters.category === item} onPress={() => onChange({ ...filters, category: filters.category === item ? undefined : item })} />}
      />
      <AppText variant="bodyStrong">Strength</AppText>
      <FlatList
        horizontal
        data={discoveryStrengths}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalChips}
        renderItem={({ item }) => <Chip label={item} selected={filters.strength === item} onPress={() => onChange({ ...filters, strength: filters.strength === item ? undefined : item })} />}
      />
    </View>
  )
}

function FilterActions({ onChange, onClose }: Pick<DiscoveryFilterSheetContentProps, 'onChange' | 'onClose'>) {
  return (
    <View style={styles.actions}>
      <ActionButton label="Show results" onPress={onClose} />
      <ActionButton label="Reset filters" secondary onPress={() => onChange(includeUnavailableCompanions(defaultDiscoveryFilters))} />
    </View>
  )
}

export function DiscoveryFilterSheetPresentation({ filters, onChange, onClose }: DiscoveryFilterSheetPresentationProps) {
  return (
    <BottomSheetPresentation
      title="Discovery filters"
      closeLabel="Close filters"
      onClose={onClose}
      footer={<FilterActions onChange={onChange} onClose={onClose} />}>
      <FilterBody filters={filters} onChange={onChange} />
    </BottomSheetPresentation>
  )
}

export function DiscoveryFilterSheet({ visible, filters, onChange, onClose }: DiscoveryFilterSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title="Discovery filters"
      closeLabel="Close filters"
      onClose={onClose}
      footer={<FilterActions onChange={onChange} onClose={onClose} />}>
      <FilterBody filters={filters} onChange={onChange} />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: density.textStackGap },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: density.textPairGap },
  horizontalChips: { gap: density.textPairGap, paddingRight: density.sheetPadding },
  actions: { gap: density.cardGap },
})
