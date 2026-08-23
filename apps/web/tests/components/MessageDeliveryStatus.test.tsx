// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MessageDeliveryStatus } from '../../src/design-system/atoms/MessageDeliveryStatus'

afterEach(cleanup)

describe('MessageDeliveryStatus', () => {
  it('labels an outgoing draft as sending', () => {
    render(<MessageDeliveryStatus state="sending" />)

    expect(screen.getByLabelText('Sending message').getAttribute('data-state')).toBe('sending')
  })

  it('labels a server-backed outgoing message as sent', () => {
    render(<MessageDeliveryStatus state="sent" />)

    expect(screen.getByLabelText('Message sent').getAttribute('data-state')).toBe('sent')
  })
})
