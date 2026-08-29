import type { PropsWithChildren } from 'react'
import { Platform, type PlatformOSType } from 'react-native'
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context'

import { StartupLoadingScreen } from './StartupLoadingScreen'

export function safeAreaIsReady(platform: PlatformOSType, topInset: number) {
  return platform !== 'android' || topInset > 0
}

export function SafeAreaRoot({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaReady>{children}</SafeAreaReady>
    </SafeAreaProvider>
  )
}

function SafeAreaReady({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets()
  return safeAreaIsReady(Platform.OS, insets.top) ? children : <StartupLoadingScreen />
}
