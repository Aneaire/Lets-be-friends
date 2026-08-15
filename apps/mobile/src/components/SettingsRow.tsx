import { Pressable, StyleSheet, View } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'

import { AppText } from './Typography'
import { AppIcon, type AppIconName } from './AppIcon'

export function SettingsRow({ label, detail, value, onPress, danger = false, icon }: {
  label: string
  detail?: string
  value?: string
  onPress?: () => void
  danger?: boolean
  icon?: AppIconName
}) {
  const theme = useAppTheme()
  const color = danger ? theme.colors.danger : theme.colors.text
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${label}${value ? `, ${value}` : ''}` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.colors.border }, pressed && styles.pressed]}>
      {icon ? <AppIcon name={icon} color={danger ? theme.colors.danger : theme.colors.selfText} size={22} /> : null}
      <View style={styles.copy}>
        <AppText variant="bodyStrong" color={color}>{label}</AppText>
        {detail ? <AppText variant="caption" color={theme.colors.textMuted}>{detail}</AppText> : null}
      </View>
      {value ? <AppText variant="caption" color={theme.colors.textMuted}>{value}</AppText> : null}
      {onPress ? <AppIcon name="chevron-forward" color={danger ? theme.colors.danger : theme.colors.textMuted} size={20} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, gap: 2 },
  pressed: { opacity: 0.62 },
})
