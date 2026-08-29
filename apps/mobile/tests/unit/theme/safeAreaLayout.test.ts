import { screenSafeAreaPadding } from '../../../src/design-system/templates/Screen'

describe('mobile screen safe-area layout', () => {
  it('applies measured insets in the first JavaScript layout', () => {
    expect(screenSafeAreaPadding({ top: 24, right: 3, bottom: 18, left: 2 })).toEqual({
      paddingTop: 24,
      paddingRight: 3,
      paddingLeft: 2,
    })
  })

  it('leaves the bottom inset for screen footers and tab navigation', () => {
    expect(screenSafeAreaPadding({ top: 24, right: 0, bottom: 18, left: 0 })).not.toHaveProperty('paddingBottom')
  })
})
