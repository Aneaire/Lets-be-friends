const mockMeasure = jest.fn()
const mockTarget = { measureLayout: mockMeasure }
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useRef: () => ({ current: mockTarget }),
  useEffect: () => undefined,
}))
jest.mock('@/theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: { socialText: 'pink', socialSoft: 'pink' } }) }))

import { ReviewCommentAnchor } from '@/features/companion/ReviewCommentAnchor'

describe('review comment notification anchor', () => {
  beforeEach(() => mockMeasure.mockReset())
  it('scrolls the outer profile to the specific comment after layout', () => {
    const scrollTo = jest.fn()
    const content = {}
    const scrollRef = { current: { getInnerViewNode: () => content, scrollTo } } as any
    mockMeasure.mockImplementation((_content, onSuccess) => onSuccess(0, 420))
    const element = ReviewCommentAnchor({ focused: true, scrollRef, children: 'Comment' })
    element.props.onLayout()
    expect(mockMeasure).toHaveBeenCalledWith(content, expect.any(Function), expect.any(Function))
    expect(scrollTo).toHaveBeenCalledWith({ y: 396, animated: true })
    expect(element.props.accessibilityRole).toBe('summary')
  })
  it('leaves ordinary comments in place and tolerates an unmounted scroll view', () => {
    const scrollRef = { current: null }
    ReviewCommentAnchor({ focused: true, scrollRef, children: 'Comment' }).props.onLayout()
    ReviewCommentAnchor({ focused: false, scrollRef, children: 'Comment' }).props.onLayout()
    expect(mockMeasure).not.toHaveBeenCalled()
  })
})
