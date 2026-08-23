import { Pressable, StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import { AppIcon } from './AppIcon'
import { AppText } from './Typography'

export function TextField({ multiline = false, invalid = false, style, ...props }: TextInputProps & { invalid?: boolean }) {
  const theme = useAppTheme()
  return <TextInput allowFontScaling maxFontSizeMultiplier={2} multiline={multiline} placeholderTextColor={theme.colors.textMuted} {...props} style={[styles.field, multiline && styles.multiline, theme.typography.body, { color: theme.colors.text, borderColor: invalid ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.surfaceRaised }, style]} />
}

export function Checkbox({ label, checked, disabled = false, onChange, style }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; style?: ViewStyle }) {
  const theme = useAppTheme()
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onChange(!checked)} style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed, disabled && styles.disabled, style]}><View style={[styles.checkbox, { borderColor: checked ? theme.colors.selfControl : theme.colors.borderStrong, backgroundColor: checked ? theme.colors.selfControl : theme.colors.surfaceRaised }]}>{checked ? <AppIcon name="checkmark" size={15} color={theme.colors.accentText} /> : null}</View><AppText>{label}</AppText></Pressable>
}

const styles = StyleSheet.create({ field: { minHeight: density.compactControlHeight, borderWidth: 1, borderRadius: density.controlRadius, paddingHorizontal: density.compactCardPadding, paddingVertical: 8 }, multiline: { minHeight: 84, maxHeight: 140, textAlignVertical: 'top' }, checkboxRow: { minHeight: density.compactControlHeight, flexDirection: 'row', alignItems: 'center', gap: 8 }, checkbox: { width: 22, height: 22, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: 0.7 }, disabled: { opacity: 0.5 } })
