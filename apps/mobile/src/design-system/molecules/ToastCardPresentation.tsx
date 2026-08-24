import { Pressable, StyleSheet, View } from 'react-native'

import { AppIcon, type AppIconName } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

import type { AppToastTone } from './AppToast'

export function ToastCardPresentation({
  message,
  tone,
  onPress,
}: {
  message: string
  tone: AppToastTone
  onPress: () => void
}) {
  const theme = useAppTheme()
  const icon: AppIconName = tone === 'info'
    ? 'information-circle-outline'
    : tone === 'success'
      ? 'checkmark-circle-outline'
      : 'alert-circle-outline'
  const accent = tone === 'info'
    ? theme.colors.self
    : tone === 'success'
      ? theme.colors.social
      : theme.colors.danger

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surfaceRaised,
          borderColor: accent,
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Dismiss notification: ${message}`}
        accessibilityHint="Dismisses this notification"
        onPress={onPress}
        style={styles.content}>
        <AppIcon name={icon} color={accent} size={22} />
        <AppText variant="bodyStrong" style={styles.copy}>
          {message}
        </AppText>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '92%',
    maxWidth: 560,
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 16,
  },
  content: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  copy: { flex: 1 },
})
