// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationItemContent } from '../../src/design-system/molecules/NotificationItemContent'

afterEach(cleanup)

describe('NotificationItemContent', () => {
  it('exposes unread state, density, tone, and semantic time content', () => {
    const { container } = render(
      <NotificationItemContent
        title="New booking request"
        body="Maya requested a coffee walk."
        timeLabel="4 minutes ago"
        dateTime="2026-08-23T11:56:00.000Z"
        density="compact"
        tone="social"
        unread
      />,
    )

    const content = container.firstElementChild
    expect(content?.getAttribute('data-density')).toBe('compact')
    expect(content?.getAttribute('data-tone')).toBe('social')
    expect(content?.getAttribute('data-unread')).toBe('true')
    expect(screen.getByText('Unread notification')).toBeTruthy()
    expect(screen.getByText('Maya requested a coffee walk.')).toBeTruthy()
    expect(screen.getByText('4 minutes ago').tagName).toBe('TIME')
    expect(screen.getByText('4 minutes ago').getAttribute('datetime')).toBe('2026-08-23T11:56:00.000Z')
  })

  it('keeps read notifications free of an unread announcement', () => {
    const { container } = render(
      <NotificationItemContent title="Report resolved" tone="self" unread={false} />,
    )

    expect(container.firstElementChild?.getAttribute('data-unread')).toBe('false')
    expect(screen.queryByText('Unread notification')).toBeNull()
    expect(screen.getByText('Report resolved')).toBeTruthy()
  })

  it('keeps navigation behavior on the caller-owned control', () => {
    const onOpen = vi.fn()
    render(
      <button type="button" onClick={onOpen}>
        <NotificationItemContent title="New message" body="Alex sent you a message." unread />
      </button>,
    )

    fireEvent.click(screen.getByRole('button', { name: /New message/ }))

    expect(onOpen).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Unread notification' })).toBeNull()
  })
})
