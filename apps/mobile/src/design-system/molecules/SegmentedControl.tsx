import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export type SegmentedControlOption<T extends string> = {
  value: T
  label: string
  disabled?: boolean
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = 'neutral',
  style,
}: {
  label: string
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  tone?: 'neutral' | 'self' | 'social'
  style?: StyleProp<ViewStyle>
}) {
  const theme = useAppTheme()
  const selectedColor = tone === 'self'
    ? theme.colors.selfText
    : tone === 'social'
      ? theme.colors.socialText
      : theme.colors.text

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.group, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }, style]}>
      {options.map((option) => {
        const selected = option.value === value
        const disabled = option.disabled === true

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, disabled }}
            aria-checked={selected}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected && { backgroundColor: theme.colors.surfaceRaised },
              disabled && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <AppText
              variant="caption"
              color={selected ? selectedColor : theme.colors.textMuted}
              style={styles.label}>
              {option.label}
            </AppText>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    width: '100%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 4,
    borderWidth: 1,
    borderRadius: density.controlRadius,
  },
  option: {
    minWidth: 0,
    minHeight: density.compactControlHeight,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: density.controlRadius - 4,
  },
  label: {
    width: '100%',
    flexShrink: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
})
