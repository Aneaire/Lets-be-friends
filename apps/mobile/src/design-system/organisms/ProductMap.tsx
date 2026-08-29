import { StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

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
  expanded?: boolean
}

export function ProductMap({ expanded = false }: ProductMapProps) {
  const theme = useAppTheme()
  return (
    <View style={[styles.fallback, expanded && styles.expanded, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}>
      <AppText variant="bodyStrong">Map preview is available in the iOS and Android app.</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: { height: 300, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 24 },
  expanded: { height: 420 },
})
