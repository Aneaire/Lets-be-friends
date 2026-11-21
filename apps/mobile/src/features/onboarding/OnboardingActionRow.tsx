import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

type PrimaryStyle = ViewStyle | ViewStyle[]

export function OnboardingActionRow({
  showBack,
  backDisabled = false,
  onBack,
  primary,
}: {
  showBack: boolean
  backDisabled?: boolean
  onBack: () => void
  primary: ReactElement<{ style?: PrimaryStyle }>
}) {
  const theme = useAppTheme()

  const primaryWithLayout = isValidElement<{ style?: PrimaryStyle }>(primary)
    ? cloneElement(primary, {
        style: [styles.primarySlot, primary.props.style] as unknown as ViewStyle,
      })
    : (primary as ReactNode)

  return (
    <View style={styles.row}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to previous step"
          accessibilityState={{ disabled: backDisabled }}
          disabled={backDisabled}
          onPress={onBack}
          style={({ pressed }) => [
            styles.back,
            {
              backgroundColor: pressed ? theme.colors.surfaceRaised : theme.colors.surface,
              borderColor: theme.colors.border,
            },
            backDisabled && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <AppIcon name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>
      ) : null}
      {primaryWithLayout}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primarySlot: { flex: 1, minWidth: 0 },
  back: {
    width: density.controlHeight,
    height: density.controlHeight,
    borderRadius: density.controlRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.76 },
})
