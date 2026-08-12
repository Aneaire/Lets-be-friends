import { Image, StyleSheet, View } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import { AppText } from './Typography'

export function Avatar({ uri, name, size = 64 }: { uri?: string; name: string; size?: number }) {
  const theme = useAppTheme()
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('')

  if (uri) {
    return (
      <Image
        accessibilityLabel={`Portrait of ${name}`}
        source={{ uri }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2, borderColor: theme.colors.border }]}
      />
    )
  }

  return (
    <View
      accessibilityLabel={`${name} profile image`}
      style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.inverse }]}>
      <AppText variant="heading" color={theme.colors.inverseText}>{initials}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  image: { borderWidth: 1, backgroundColor: '#D9D9D9' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
})
