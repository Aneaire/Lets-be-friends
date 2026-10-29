import { StyleSheet, View } from 'react-native'

import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density, radii } from '@/theme/tokens'

export type ComposerContextMode = 'reply' | 'edit'

export function ComposerContextBanner({ mode, title, preview, onCancel }: {
  mode: ComposerContextMode
  title: string
  preview: string
  onCancel: () => void
}) {
  const theme = useAppTheme()
  const accent = mode === 'edit' ? theme.colors.selfText : theme.colors.socialText

  return (
    <View style={[styles.banner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.copy}>
        <AppText variant="caption" color={accent}>{title}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{preview}</AppText>
      </View>
      <IconButton
        label={mode === 'edit' ? 'Cancel editing message' : 'Cancel reply'}
        icon="close-outline"
        tone="neutral"
        onPress={onCancel}
        style={styles.close}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: density.cardGap,
    paddingVertical: density.textSectionGap,
    paddingLeft: density.cardGap,
    paddingRight: density.cardGap,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    minWidth: 0,
  },
  accent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: radii.pill,
  },
  copy: { flex: 1, minWidth: 0, gap: density.textPairGap },
  close: { width: 32, height: 32 },
})
