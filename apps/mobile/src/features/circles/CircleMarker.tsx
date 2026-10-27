import { Image, StyleSheet, View } from 'react-native'

import { BrandMark } from '@/design-system/atoms/Brand'
import { useAppTheme } from '@/theme/ThemeProvider'

/**
 * The Circle identity marker shared by every mobile Circle surface, matching
 * the website: the uploaded icon when there is one, otherwise the brand logo
 * inside the same circle frame.
 */
export function CircleMarker({ iconUrl, name, joined = false, size = 32 }: {
  iconUrl?: string | null
  name: string
  joined?: boolean
  size?: number
}) {
  const theme = useAppTheme()
  const label = `${name} Circle ${iconUrl ? 'icon' : 'mark'}`

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[
        styles.marker,
        {
          width: size,
          height: size,
          borderColor: joined ? theme.colors.social : theme.colors.borderStrong,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {iconUrl ? (
        <Image
          source={{ uri: iconUrl }}
          style={styles.icon}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        <BrandMark width={size * 0.68} height={size * 0.68} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  marker: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 999, overflow: 'hidden' },
  icon: { width: '100%', height: '100%' },
})
