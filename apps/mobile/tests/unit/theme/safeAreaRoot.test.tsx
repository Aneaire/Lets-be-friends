import { safeAreaIsReady } from '../../../src/design-system/templates/SafeAreaRoot'

describe('mobile root safe area', () => {
  it('waits for a measured Android top inset', () => {
    expect(safeAreaIsReady('android', 0)).toBe(false)
    expect(safeAreaIsReady('android', 24)).toBe(true)
  })

  it('does not block platforms that can validly start at zero', () => {
    expect(safeAreaIsReady('ios', 0)).toBe(true)
    expect(safeAreaIsReady('web', 0)).toBe(true)
  })
})
