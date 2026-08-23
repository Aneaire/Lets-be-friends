import { StyleSheet, View } from 'react-native'
import { cloneElement, type ReactElement } from 'react'
import type { TextInputProps } from 'react-native'
import { AppText } from '../atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

type FormFieldControlProps = TextInputProps & { invalid?: boolean }

export function FormField({ label, optional = false, hint, error, children }: { label: string; optional?: boolean; hint?: string; error?: string; children: ReactElement<FormFieldControlProps> }) {
  const theme = useAppTheme()
  const supportingText = error ?? hint
  const control = cloneElement(children, {
    accessibilityLabel: children.props.accessibilityLabel ?? label,
    accessibilityHint: children.props.accessibilityHint ?? supportingText,
    invalid: Boolean(error) || children.props.invalid,
  })
  return <View style={styles.root}><View style={styles.labelRow}><AppText variant="label">{label}</AppText>{optional ? <AppText variant="caption" color={theme.colors.textMuted}>Optional</AppText> : null}</View>{control}{supportingText ? <AppText accessibilityRole={error ? 'alert' : undefined} variant="caption" color={error ? theme.colors.danger : theme.colors.textMuted}>{supportingText}</AppText> : null}</View>
}

const styles = StyleSheet.create({ root: { gap: density.textStackGap }, labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 } })
