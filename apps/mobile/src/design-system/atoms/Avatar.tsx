import { Image, StyleSheet, View } from 'react-native'
import { useEffect, useState } from 'react'

import { useAppTheme } from '@/theme/ThemeProvider'
import { AppIcon } from '@/design-system/atoms/AppIcon'

export function Avatar({ uri, name, size = 64 }: { uri?: string; name: string; size?: number }) {
  const theme = useAppTheme()
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => setImageFailed(false), [uri])

  if (uri && !imageFailed) {
    return (
      <Image
        accessibilityLabel={`Portrait of ${name}`}
        source={{ uri }}
        onError={() => setImageFailed(true)}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2, borderColor: theme.colors.border }]}
      />
    )
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${name} has no profile photo`}
      style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
      <AppIcon name="person" color={theme.colors.textMuted} size={Math.max(18, Math.round(size * 0.5))} />
    </View>
  )
}

const styles = StyleSheet.create({
  image: { borderWidth: 1, backgroundColor: '#D9D9D9' },
  fallback: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
})
