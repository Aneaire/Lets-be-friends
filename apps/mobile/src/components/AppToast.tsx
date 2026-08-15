import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import { useReducedMotion } from '@/utils/accessibility'

import { AppIcon, type AppIconName } from './AppIcon'
import { AppText } from './Typography'

export type AppToastTone = 'info' | 'success' | 'error'

const toastType: Record<AppToastTone, string> = {
  info: 'appInfo',
  success: 'appSuccess',
  error: 'appError',
}

export function showAppToast(message: string, tone: AppToastTone = 'info') {
  Toast.show({
    type: toastType[tone],
    text1: message,
    position: 'top',
    topOffset: 132,
    visibilityTime: tone === 'error' ? 5_000 : 3_500,
  })
}

export function hideAppToast() {
  Toast.hide()
}

export function useAppToastMessage(message: string | null | undefined) {
  useEffect(() => {
    if (!message) return

    const success = /\b(accepted|complete|posted|saved|sent|submitted|succeeded|updated|uploaded)\b/i.test(message)
    showAppToast(message, success ? 'success' : 'error')
  }, [message])
}

export function AppToastHost() {
  const theme = useAppTheme()
  const reduceMotion = useReducedMotion()

  const config: ToastConfig = {
    appInfo: (params) => <ToastCard {...params} icon="information-circle-outline" accent={theme.colors.self} live="polite" />,
    appSuccess: (params) => <ToastCard {...params} icon="checkmark-circle-outline" accent={theme.colors.social} live="polite" />,
    appError: (params) => <ToastCard {...params} icon="alert-circle-outline" accent={theme.colors.danger} live="assertive" />,
  }

  return (
    <Toast
      config={config}
      position="top"
      topOffset={132}
      visibilityTime={3_500}
      swipeable
      animationConfig={{ type: 'timing', duration: reduceMotion ? 0 : 180 }}
    />
  )
}

function ToastCard({ text1, onPress, icon, accent, live }: ToastConfigParams<unknown> & {
  icon: AppIconName
  accent: string
  live: 'polite' | 'assertive'
}) {
  const theme = useAppTheme()

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion={live}
      onTouchEnd={onPress}
      style={[
        styles.card,
        { backgroundColor: theme.colors.surfaceRaised, borderColor: accent },
      ]}>
      <AppIcon name={icon} color={accent} size={22} />
      <AppText variant="bodyStrong" style={styles.copy}>{text1}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '92%',
    maxWidth: 560,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
  },
  copy: { flex: 1 },
})
