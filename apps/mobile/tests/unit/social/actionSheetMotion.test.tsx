import { ActionSheet } from '@/design-system/molecules/ActionSheet'
import { modalAnimationPlan } from '@/design-system/molecules/ModalPresentation'

describe('action sheet motion', () => {
  it('slides the menu upward while fading a fixed backdrop', () => {
    const sheet = ActionSheet({
      visible: true,
      title: 'Comment options',
      items: [{ label: 'Report comment', icon: 'flag-outline', onPress: jest.fn() }],
      onClose: jest.fn(),
    })

    expect(sheet.props.animationType).toBe('slide')
    expect(modalAnimationPlan(sheet.props.animationType, false)).toEqual({
      native: 'none',
      backdrop: 'fade',
      surface: 'slide',
    })
  })

  it('removes both animations when reduced motion is enabled', () => {
    expect(modalAnimationPlan('slide', true)).toEqual({
      native: 'none',
      backdrop: 'none',
      surface: 'none',
    })
  })
})
