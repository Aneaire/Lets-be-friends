import {
  isMessageSwipeGesture,
  messageSwipeAction,
  MESSAGE_SWIPE_THRESHOLD,
} from '@/features/messaging/messageSwipe'

describe('message swipe decisions', () => {
  it('claims a horizontal drag and leaves vertical scrolling alone', () => {
    expect(isMessageSwipeGesture(24, 4)).toBe(true)
    expect(isMessageSwipeGesture(-24, 4)).toBe(true)
    expect(isMessageSwipeGesture(24, 30)).toBe(false)
    expect(isMessageSwipeGesture(6, 0)).toBe(false)
  })

  it('replies on a right swipe and opens actions on a left swipe', () => {
    expect(MESSAGE_SWIPE_THRESHOLD).toBe(56)
    expect(messageSwipeAction(MESSAGE_SWIPE_THRESHOLD)).toBe('reply')
    expect(messageSwipeAction(-MESSAGE_SWIPE_THRESHOLD)).toBe('actions')
    expect(messageSwipeAction(MESSAGE_SWIPE_THRESHOLD - 1)).toBe('none')
    expect(messageSwipeAction(-MESSAGE_SWIPE_THRESHOLD + 1)).toBe('none')
  })
})
