// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MessageBubble } from '../../src/features/messaging/MessageBubble'

afterEach(cleanup)

describe('MessageBubble', () => {
  it('presents incoming and outgoing messages through the same readable shell', () => {
    const { container, rerender } = render(
      <MessageBubble
        direction="incoming"
        body="Would 2:30 PM work?"
        timestamp="2:24 PM"
        dateTime="2026-08-23T14:24:00.000Z"
      />,
    )

    const message = container.querySelector('.ds-message')
    expect(message?.getAttribute('data-direction')).toBe('incoming')
    expect(screen.getByText('Would 2:30 PM work?')).toBeTruthy()
    expect(screen.queryByLabelText('Message sent')).toBeNull()

    rerender(
      <MessageBubble
        direction="outgoing"
        body="Yes, that works."
        timestamp="2:25 PM"
        dateTime="2026-08-23T14:25:00.000Z"
        status="sent"
      />,
    )

    expect(message?.getAttribute('data-direction')).toBe('outgoing')
    expect(screen.getByLabelText('Message sent')).toBeTruthy()
  })

  it('keeps media outside the neutral content bubble and exposes report actions', () => {
    const onReport = vi.fn()
    const { container } = render(
      <MessageBubble
        direction="incoming"
        body="The arrival map is attached."
        timestamp="2:26 PM"
        dateTime="2026-08-23T14:26:00.000Z"
        media={<button type="button" aria-label="Open arrival map"><img src="/arrival-map.png" alt="Arrival map" /></button>}
        attachments={<a href="/notes.pdf">Open session notes</a>}
        actions={<button type="button" aria-label="Report message" onClick={onReport}>Report</button>}
      />,
    )

    const bubble = container.querySelector('.ds-message-bubble')
    const media = container.querySelector('.ds-message-media')
    const metadata = container.querySelector('.ds-message-metadata')
    const timestamp = screen.getByText('2:26 PM')

    expect(media?.contains(screen.getByRole('button', { name: 'Open arrival map' }))).toBe(true)
    expect(bubble?.contains(screen.getByRole('link', { name: 'Open session notes' }))).toBe(true)
    expect(bubble?.contains(timestamp)).toBe(false)
    expect(metadata?.contains(timestamp)).toBe(true)
    expect(timestamp.getAttribute('datetime')).toBe('2026-08-23T14:26:00.000Z')

    fireEvent.click(screen.getByRole('button', { name: 'Report message' }))
    expect(onReport).toHaveBeenCalledOnce()
  })

  it('renders an image-only message without an empty bubble or duplicate timestamp', () => {
    const { container } = render(
      <MessageBubble
        direction="outgoing"
        timestamp="2:27 PM"
        media={<img src="/session-photo.png" alt="Session" />}
        status="sent"
      />,
    )

    expect(container.querySelector('.ds-message-bubble')).toBeNull()
    expect(screen.getAllByText('2:27 PM')).toHaveLength(1)
    expect(screen.getByLabelText('Message sent')).toBeTruthy()
  })

  it('keeps the shared outer presentation through sending, acknowledgement, and reconciliation', () => {
    const longBody = 'A long uninterrupted-reference-number-123456789012345678901234567890 stays in the shared message surface while delivery state changes.'
    const { container, rerender } = render(
      <MessageBubble
        direction="outgoing"
        body={longBody}
        timestamp="2:28 PM"
        status="sending"
        pending
      />,
    )

    const message = container.querySelector('.ds-message')
    const bubble = container.querySelector('.ds-message-bubble')
    expect(message?.getAttribute('data-pending')).toBe('true')
    expect(screen.getByLabelText('Sending message')).toBeTruthy()
    expect(screen.getByText(longBody)).toBeTruthy()

    rerender(
      <MessageBubble
        direction="outgoing"
        body={longBody}
        timestamp="2:28 PM"
        status="sent"
        pending
      />,
    )

    expect(container.querySelector('.ds-message')).toBe(message)
    expect(container.querySelector('.ds-message-bubble')).toBe(bubble)
    expect(message?.getAttribute('data-pending')).toBe('true')
    expect(screen.getByLabelText('Message sent')).toBeTruthy()

    rerender(
      <MessageBubble
        direction="outgoing"
        body={longBody}
        timestamp="2:28 PM"
        status="sent"
      />,
    )

    expect(container.querySelector('.ds-message')).toBe(message)
    expect(container.querySelector('.ds-message-bubble')).toBe(bubble)
    expect(message?.hasAttribute('data-pending')).toBe(false)
  })
})
