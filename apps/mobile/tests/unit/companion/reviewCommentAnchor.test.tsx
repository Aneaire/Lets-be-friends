const mockMeasure = jest.fn()
const mockTarget = { measureLayout: mockMeasure }
const mockUseRef = jest.fn()
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useRef: (initial: unknown) => mockUseRef(initial),
  useEffect: () => undefined,
  useState: (initial: unknown) => [initial, jest.fn()],
}))
jest.mock('@/theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: { socialText: 'pink', socialSoft: 'pink' } }) }))

import { NotificationTargetAnchor } from '@/features/notifications/NotificationTargetAnchor'

describe('notification target anchor', () => {
  beforeEach(() => {
    mockMeasure.mockReset()
    mockUseRef.mockReset()
    mockUseRef.mockImplementationOnce(() => ({ current: mockTarget }))
    mockUseRef.mockImplementation((initial: unknown) => ({ current: initial }))
  })

  it('scrolls the outer surface to the specific target after layout', () => {
    const scrollTo = jest.fn()
    const content = {}
    const scrollRef = { current: { getInnerViewNode: () => content, scrollTo } } as any
    mockMeasure.mockImplementation((_content, onSuccess) => onSuccess(0, 420))
    const element = NotificationTargetAnchor({ focused: true, scrollRef, children: 'Comment' })
    element.props.onLayout()
    expect(mockMeasure).toHaveBeenCalledWith(content, expect.any(Function), expect.any(Function))
    expect(scrollTo).toHaveBeenCalledWith({ y: 396, animated: true })
    expect(element.props.accessibilityRole).toBe('summary')
  })

  it('leaves ordinary targets in place and tolerates an unmounted scroll view', () => {
    const scrollRef = { current: null }
    NotificationTargetAnchor({ focused: true, scrollRef, children: 'Comment' }).props.onLayout()
    NotificationTargetAnchor({ focused: false, scrollRef, children: 'Comment' }).props.onLayout()
    expect(mockMeasure).not.toHaveBeenCalled()
  })
})
