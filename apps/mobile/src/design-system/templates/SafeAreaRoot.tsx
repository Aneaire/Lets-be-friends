import type { PropsWithChildren } from 'react'
import { Dimensions, Platform, StatusBar, type PlatformOSType } from 'react-native'
import { SafeAreaProvider, initialWindowMetrics, type Metrics } from 'react-native-safe-area-context'

type WindowFrame = { width: number; height: number }

export function resolveInitialSafeAreaMetrics(
  metrics: Metrics | null,
  platform: PlatformOSType,
  statusBarHeight: number | undefined,
  windowFrame: WindowFrame,
): Metrics | null {
  if (platform !== 'android' || !statusBarHeight || (metrics?.insets.top ?? 0) > 0) return metrics

  return {
    frame: metrics?.frame ?? { x: 0, y: 0, width: windowFrame.width, height: windowFrame.height },
    insets: { bottom: 0, left: 0, right: 0, ...metrics?.insets, top: statusBarHeight },
  }
}

export function SafeAreaRoot({ children }: PropsWithChildren) {
  const initialMetrics = resolveInitialSafeAreaMetrics(
    initialWindowMetrics,
    Platform.OS,
    StatusBar.currentHeight,
    Dimensions.get('window'),
  )

  return <SafeAreaProvider initialMetrics={initialMetrics}>{children}</SafeAreaProvider>
}
