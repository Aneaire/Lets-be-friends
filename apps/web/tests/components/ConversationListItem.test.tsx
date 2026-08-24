// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ConversationListItemContent } from '../../src/features/messaging/ConversationListItem'

afterEach(cleanup)

describe('ConversationListItemContent', () => {
  it('renders preview, timestamp, and a readable unread count', () => {
    render(
      <a href="#conversation" className="conversation-rail-link">
        <ConversationListItemContent
          name="Alex Rivera"
          preview="You: Booking details sent"
          timeLabel="2:24 PM"
          dateTime="2026-08-23T14:24:00.000Z"
          unreadCount={2}
        />
      </a>,
    )
    expect(screen.getByText('You: Booking details sent')).toBeTruthy()
    expect(screen.getByText('2:24 PM').getAttribute('datetime')).toBe('2026-08-23T14:24:00.000Z')
    expect(screen.getByLabelText('2 unread messages')).toBeTruthy()
  })

  it('replaces message content with the safety state for a suspended member', () => {
    render(
      <a href="#conversation" className="conversation-rail-link">
        <ConversationListItemContent name="Alex Rivera" preview="Hidden message" suspended />
      </a>,
    )
    expect(screen.getByText('Messaging unavailable')).toBeTruthy()
    expect(screen.queryByText('Hidden message')).toBeNull()
  })
})
