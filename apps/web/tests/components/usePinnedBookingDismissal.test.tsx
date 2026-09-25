// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePinnedBookingDismissal } from '../../src/features/booking/usePinnedBookingDismissal'

const conversationOne = { conversationId: 'conversation-1', bookingId: 'booking-a' }

describe('usePinnedBookingDismissal', () => {
  it('keeps the current booking hidden after dismissal', () => {
    const { result, rerender } = renderHook(
      (props: { conversationId: string; bookingId: string }) => usePinnedBookingDismissal(props),
      { initialProps: conversationOne },
    )

    expect(result.current.dismissed).toBe(false)
    act(() => result.current.dismiss())
    expect(result.current.dismissed).toBe(true)

    rerender({ conversationId: 'conversation-1', bookingId: 'booking-a' })
    expect(result.current.dismissed).toBe(true)
  })

  it('resets dismissal when a different current booking appears', () => {
    const { result, rerender } = renderHook(
      (props: { conversationId: string; bookingId: string }) => usePinnedBookingDismissal(props),
      { initialProps: conversationOne },
    )

    act(() => result.current.dismiss())
    expect(result.current.dismissed).toBe(true)

    rerender({ conversationId: 'conversation-1', bookingId: 'booking-b' })
    expect(result.current.dismissed).toBe(false)
  })

  it('resets dismissal when the conversation changes', () => {
    const { result, rerender } = renderHook(
      (props: { conversationId: string; bookingId: string }) => usePinnedBookingDismissal(props),
      { initialProps: conversationOne },
    )

    act(() => result.current.dismiss())
    expect(result.current.dismissed).toBe(true)

    rerender({ conversationId: 'conversation-2', bookingId: 'booking-a' })
    expect(result.current.dismissed).toBe(false)
  })

  it('stays visible when there is no current booking to dismiss', () => {
    const { result } = renderHook(
      () => usePinnedBookingDismissal({ conversationId: 'conversation-1', bookingId: undefined }),
    )

    expect(result.current.dismissed).toBe(false)
    act(() => result.current.dismiss())
    expect(result.current.dismissed).toBe(false)
  })
})
