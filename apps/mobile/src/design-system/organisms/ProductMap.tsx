import { Pressable, StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { webPinOriginCandidates } from '@/features/discovery/nearbyOrigin'

export type ProductMapPoint = {
  id: string
  latitude: number
  longitude: number
  name: string
}

export type ProductMapProps = {
  center?: { latitude: number; longitude: number } | null
  radiusKm?: number
  points?: ProductMapPoint[]
  onSelectPoint?: (id: string) => void
  onPickLocation?: (origin: { latitude: number; longitude: number }) => void
  pinMode?: boolean
  expanded?: boolean
}

export function ProductMap({ expanded = false, pinMode = false, onPickLocation }: ProductMapProps) {
  const theme = useAppTheme()
  const candidates = webPinOriginCandidates()

  if (pinMode) {
    return (
      <View style={[styles.fallback, expanded && styles.expanded, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}>
        <AppText variant="bodyStrong" style={styles.pinTitle}>Choose an approximate area</AppText>
        <AppText variant="caption" color={theme.colors.textMuted} style={styles.pinCopy}>
          The live map is available in the iOS and Android app. Select an area below to set your search origin.
        </AppText>
        <View style={styles.pinGrid}>
          {candidates.map((candidate) => (
            <Pressable
              key={`${candidate.latitude}-${candidate.longitude}`}
              accessibilityRole="button"
              accessibilityLabel={`Set search origin near ${candidate.label}`}
              onPress={() => onPickLocation?.({ latitude: candidate.latitude, longitude: candidate.longitude })}
              style={({ pressed }) => [
                styles.pinMarker,
                { backgroundColor: theme.colors.socialControl, borderColor: theme.colors.accentText },
                pressed && styles.pressed,
              ]}>
              <AppText variant="caption" color={theme.colors.accentText} style={styles.pinLabel}>{candidate.label}</AppText>
            </Pressable>
          ))}
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.fallback, expanded && styles.expanded, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}>
      <AppText variant="bodyStrong">Map preview is available in the iOS and Android app.</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: { height: 300, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  expanded: { height: 420 },
  pinTitle: { textAlign: 'center' },
  pinCopy: { textAlign: 'center', maxWidth: 320 },
  pinGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 6 },
  pinMarker: { minWidth: 76, minHeight: 40, paddingHorizontal: 10, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pinLabel: { fontWeight: '700' },
  pressed: { opacity: 0.72 },
})
