import { StyleSheet, View } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import { AppText } from './Typography'

export type TrustThreadItem = {
  title: string
  detail: string
  tone?: 'self' | 'social'
}

export function TrustThread({ items }: { items: TrustThreadItem[] }) {
  const theme = useAppTheme()

  return (
    <View accessibilityLabel="Trust details" style={styles.container}>
      <View style={[styles.line, { backgroundColor: theme.colors.borderStrong }]} />
      {items.map((item, index) => (
        <View key={item.title} style={styles.item}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: theme.colors[item.tone ?? (index === 0 ? 'self' : 'social')],
                borderColor: theme.colors.background,
              },
            ]}
          />
          <View style={styles.copy}>
            <AppText variant="bodyStrong">{item.title}</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>{item.detail}</AppText>
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { position: 'relative', gap: 18 },
  line: { position: 'absolute', left: 8, top: 10, bottom: 10, width: 1 },
  item: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  dot: { width: 17, height: 17, borderRadius: 9, borderWidth: 4, marginTop: 2 },
  copy: { flex: 1, gap: 2 },
})
