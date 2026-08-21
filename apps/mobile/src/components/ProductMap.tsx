import { StyleSheet, View } from 'react-native'

import { AppText } from '@/components/Typography'
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
}

export function ProductMap(_props: ProductMapProps) {
  const theme = useAppTheme()
  return (
    <View style={[styles.fallback, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}>
      <AppText variant="bodyStrong">Map preview is available in the iOS and Android app.</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: { height: 300, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 24 },
})
