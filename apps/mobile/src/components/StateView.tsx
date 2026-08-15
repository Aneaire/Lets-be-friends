import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from './ActionButton'
import { AppText } from './Typography'

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
  return (
    <View style={[embedded ? styles.embedded : styles.state, embedded && { borderColor: theme.colors.border }]}>
      {eyebrow ? <AppText variant="label" color={theme.colors[intent]}>{eyebrow}</AppText> : null}
      <AppText variant={embedded ? 'heading' : 'title'}>{title}</AppText>
      {detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}
      {loading ? <ActivityIndicator accessibilityLabel="Loading" color={theme.colors[intent]} /> : null}
      {actionLabel && onAction ? <ActionButton label={actionLabel} onPress={onAction} intent={intent} secondary /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  state: { flex: 1, justifyContent: 'center', gap: 14, paddingVertical: 40 },
  embedded: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
})
