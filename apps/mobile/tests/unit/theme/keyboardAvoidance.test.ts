import { keyboardAvoidingBehavior } from '../../../src/design-system/templates/Screen'

describe('mobile keyboard avoidance', () => {
  it('adds keyboard padding on iOS', () => {
    expect(keyboardAvoidingBehavior('ios')).toBe('padding')
  })

  it('adds keyboard padding on Android when edge-to-edge prevents the window from resizing', () => {
    expect(keyboardAvoidingBehavior('android')).toBe('padding')
  })

  it('does not alter web layout when the mobile app runs in a browser', () => {
    expect(keyboardAvoidingBehavior('web')).toBeUndefined()
  })
})
