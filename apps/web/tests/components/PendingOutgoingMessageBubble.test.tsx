// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PendingOutgoingMessageBubble } from '../../src/features/messaging/PendingOutgoingMessageBubble'

afterEach(cleanup)

describe('PendingOutgoingMessageBubble', () => {
  it('renders a sending body and attachment names in the shared outgoing shell', () => {
    const { container } = render(
      <PendingOutgoingMessageBubble
        body="Here are the notes."
        attachmentNames={['session-notes.pdf', 'arrival-map.png']}
        timestamp="2:28 PM"
        dateTime="2026-08-23T14:28:00.000Z"
      />,
    )

    expect(screen.getByText('Here are the notes.')).toBeTruthy()
    expect(screen.getByText('session-notes.pdf, arrival-map.png')).toBeTruthy()
    expect(screen.getByText('2:28 PM').getAttribute('datetime')).toBe('2026-08-23T14:28:00.000Z')
    expect(screen.getByLabelText('Sending message')).toBeTruthy()
    expect(container.querySelector('.ds-message')?.getAttribute('data-direction')).toBe('outgoing')
    expect(container.querySelector('.ds-message')?.getAttribute('data-pending')).toBe('true')
  })

  it('keeps an attachment-only optimistic message visible after acknowledgement', () => {
    render(
      <PendingOutgoingMessageBubble
        body=""
        attachmentNames={['session-notes.pdf']}
        timestamp="2:29 PM"
        dateTime="2026-08-23T14:29:00.000Z"
        acknowledged
      />,
    )

    expect(screen.getByText('session-notes.pdf')).toBeTruthy()
    expect(screen.getByLabelText('Message sent')).toBeTruthy()
  })
})
