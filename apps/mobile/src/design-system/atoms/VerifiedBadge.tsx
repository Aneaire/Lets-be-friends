import { StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

export function VerifiedBadge({ label = 'Identity verified', detail }: { label?: string; detail?: string }) {
  const theme = useAppTheme()
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: theme.colors.selfControl, borderColor: theme.colors.background }]}>
      <AppText variant="caption" color={theme.colors.accentText} style={styles.mark}>
        ✓
      </AppText>
      {detail ? (
        <AppText variant="caption" color={theme.colors.textMuted} style={styles.detail}>
          {detail}
        </AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    flexDirection: 'row',
    gap: 4,
  },
  mark: { fontWeight: '800', lineHeight: 14 },
  detail: { flexShrink: 1 },
})
