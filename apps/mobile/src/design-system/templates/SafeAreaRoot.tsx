import type { PropsWithChildren } from 'react'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'

export function SafeAreaRoot({ children }: PropsWithChildren) {
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}>{children}</SafeAreaProvider>
}
