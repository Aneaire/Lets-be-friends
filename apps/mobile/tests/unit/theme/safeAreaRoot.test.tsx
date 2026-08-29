import { initialWindowMetrics } from 'react-native-safe-area-context'

import { SafeAreaRoot } from '../../../src/design-system/templates/SafeAreaRoot'

describe('mobile root safe area', () => {
  it('seeds the first render with native window insets', () => {
    const element = SafeAreaRoot({ children: null })

    expect(element.props.initialMetrics).toBe(initialWindowMetrics)
  })
})
