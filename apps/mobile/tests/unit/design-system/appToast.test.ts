import { APP_TOAST_TOP_GAP, appToastTopOffset } from '@/design-system/molecules/AppToast'

describe('app toast placement', () => {
  it('sits just below the status bar instead of a fixed 132px offset', () => {
    expect(APP_TOAST_TOP_GAP).toBe(8)
    expect(appToastTopOffset(0)).toBe(8)
    expect(appToastTopOffset(24)).toBe(32)
    expect(appToastTopOffset(52)).toBe(60)
  })

  it('never places the toast under the status bar', () => {
    expect(appToastTopOffset(-4)).toBe(8)
  })
})
