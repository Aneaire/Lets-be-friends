import Toast, { type ToastConfig } from 'react-native-toast-message'
import { useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useReducedMotion } from '@/utils/accessibility'

import { ToastCardPresentation } from './ToastCardPresentation'

export type AppToastTone = 'info' | 'success' | 'error'

export const APP_TOAST_TOP_GAP = 8

export function appToastTopOffset(topInset: number) {
  return Math.max(APP_TOAST_TOP_GAP, topInset + APP_TOAST_TOP_GAP)
}

let currentTopOffset = APP_TOAST_TOP_GAP

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
    topOffset: currentTopOffset,
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
  const reduceMotion = useReducedMotion()
  const insets = useSafeAreaInsets()
  const topOffset = appToastTopOffset(insets.top)

  useEffect(() => {
    currentTopOffset = topOffset
  }, [topOffset])

  const config: ToastConfig = {
    appInfo: ({ text1, onPress }) => (
      <ToastCardPresentation
        message={text1 ?? ''}
        tone="info"
        onPress={onPress ?? hideAppToast}
      />
    ),
    appSuccess: ({ text1, onPress }) => (
      <ToastCardPresentation
        message={text1 ?? ''}
        tone="success"
        onPress={onPress ?? hideAppToast}
      />
    ),
    appError: ({ text1, onPress }) => (
      <ToastCardPresentation
        message={text1 ?? ''}
        tone="error"
        onPress={onPress ?? hideAppToast}
      />
    ),
  }

  return (
    <Toast
      config={config}
      position="top"
      topOffset={topOffset}
      visibilityTime={3_500}
      swipeable
      animationConfig={{ type: 'timing', duration: reduceMotion ? 0 : 180 }}
    />
  )
}
