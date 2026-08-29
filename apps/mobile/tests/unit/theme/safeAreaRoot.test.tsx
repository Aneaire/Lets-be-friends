import type { Metrics } from 'react-native-safe-area-context'

import { resolveInitialSafeAreaMetrics } from '../../../src/design-system/templates/SafeAreaRoot'

describe('mobile root safe area', () => {
  const zeroInsets: Metrics = {
    frame: { x: 0, y: 0, width: 412, height: 916 },
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  }

  it('uses the Android status bar height when startup metrics report a zero top inset', () => {
    const metrics = resolveInitialSafeAreaMetrics(zeroInsets, 'android', 24, { width: 412, height: 916 })

    expect(metrics?.insets.top).toBe(24)
    expect(metrics?.frame).toBe(zeroInsets.frame)
  })

  it('creates Android startup metrics when the native metrics are not ready', () => {
    expect(resolveInitialSafeAreaMetrics(null, 'android', 24, { width: 412, height: 916 })).toEqual({
      frame: { x: 0, y: 0, width: 412, height: 916 },
      insets: { top: 24, right: 0, bottom: 0, left: 0 },
    })
  })

  it('keeps valid native metrics unchanged', () => {
    const measured = { ...zeroInsets, insets: { ...zeroInsets.insets, top: 32 } }

    expect(resolveInitialSafeAreaMetrics(measured, 'android', 24, { width: 412, height: 916 })).toBe(measured)
    expect(resolveInitialSafeAreaMetrics(zeroInsets, 'ios', undefined, { width: 412, height: 916 })).toBe(zeroInsets)
  })
})
