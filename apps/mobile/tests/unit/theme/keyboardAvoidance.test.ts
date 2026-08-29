import { keyboardAvoidingBehavior } from '../../../src/design-system/templates/Screen'

describe('mobile keyboard avoidance', () => {
  it('adds keyboard padding on iOS', () => {
    expect(keyboardAvoidingBehavior('ios')).toBe('padding')
  })

  it('lets Android window resize handle the keyboard without a second height adjustment', () => {
    expect(keyboardAvoidingBehavior('android')).toBeUndefined()
  })

  it('does not alter web layout when the mobile app runs in a browser', () => {
    expect(keyboardAvoidingBehavior('web')).toBeUndefined()
  })
})
