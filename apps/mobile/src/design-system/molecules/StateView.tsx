import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'

export function StateView({ eyebrow, title, detail, actionLabel, onAction, loading = false, embedded = false, intent = 'social' }: {
  eyebrow?: string
  title: string
  detail?: string
  actionLabel?: string
  onAction?: () => void
  loading?: boolean
  embedded?: boolean
  intent?: 'social' | 'self'
}) {
  const theme = useAppTheme()
  const accentText = intent === 'self' ? theme.colors.selfText : theme.colors.socialText
  return (
    <View style={[embedded ? styles.embedded : styles.state, embedded && { borderColor: theme.colors.border }]}>
      <View style={styles.copy}>
        {eyebrow ? <AppText variant="label" color={accentText}>{eyebrow}</AppText> : null}
        <AppText variant={embedded ? 'heading' : 'title'}>{title}</AppText>
        {detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}
      </View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading" color={accentText} /> : null}
      {actionLabel && onAction ? <ActionButton label={actionLabel} onPress={onAction} intent={intent} secondary /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  state: { flex: 1, justifyContent: 'center', gap: 12, paddingVertical: density.sectionGap + 4 },
  embedded: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  copy: { gap: density.textStackGap },
})
