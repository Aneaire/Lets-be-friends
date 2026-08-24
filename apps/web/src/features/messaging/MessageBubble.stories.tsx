import type { Meta, StoryObj } from '@storybook/react-vite'
import { Flag, Paperclip } from 'lucide-react'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { MessageImageGallery } from '../../design-system/molecules/MessageImages'
import { CompactComposer } from './CompactComposer'
import { MessageBubble } from './MessageBubble'
import { PendingOutgoingMessageBubble } from './PendingOutgoingMessageBubble'

const meta = {
  title: 'Web/Organisms/Messaging thread',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const demoImage = {
  storageId: 'arrival-map',
  fileName: 'arrival-map.png',
  url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 400'%3E%3Crect width='640' height='400' fill='%23e7e7e7'/%3E%3Cpath d='M80 300L220 170l100 70 150-150 90 90' fill='none' stroke='%23474747' stroke-width='18'/%3E%3Ccircle cx='470' cy='90' r='26' fill='%23474747'/%3E%3C/svg%3E",
}

export const Incoming: Story = {
  render: () => (
    <div className="ds-story-thread">
      <MessageBubble direction="incoming" body="Would 2:30 PM work for the online session?" timestamp="2:24 PM" />
    </div>
  ),
}

export const Outgoing: Story = {
  render: () => (
    <div className="ds-story-thread">
      <MessageBubble direction="outgoing" body="Yes. I will send the final booking details here." timestamp="2:26 PM" status="sent" />
    </div>
  ),
}

function ReportActionExample() {
  const [reported, setReported] = useState(false)
  return (
    <div className="ds-story-thread">
      <MessageBubble
        direction="incoming"
        body="Here is the updated meeting point."
        timestamp="2:26 PM"
        actions={(
          <button
            type="button"
            className="direct-message-report"
            aria-label="Report message"
            title="Report message"
            onClick={() => setReported(true)}
          >
            <Flag size={14} aria-hidden="true" />
          </button>
        )}
      />
      {reported ? <p role="status" className="soft">Message sent to safety review.</p> : null}
    </div>
  )
}

export const ReportAction: Story = {
  render: () => <ReportActionExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Report message' }))
    await expect(canvas.getByRole('status')).toHaveTextContent('Message sent to safety review.')
  },
}

export const MediaAndContentSlot: Story = {
  render: () => (
    <div className="ds-story-thread">
      <MessageBubble
        direction="incoming"
        body="Use the marked entrance. I also attached the session notes."
        timestamp="2:27 PM"
        dateTime="2026-08-23T14:27:00.000Z"
        media={<MessageImageGallery images={[demoImage]} onOpen={() => undefined} />}
        attachments={(
          <a className="btn btn-neutral btn-sm" href="#session-notes">
            <Paperclip size={15} aria-hidden="true" />
            Open session-notes.pdf
          </a>
        )}
      />
    </div>
  ),
}

function DeliveryTransitionExample() {
  const [stage, setStage] = useState<'sending' | 'acknowledged' | 'server'>('sending')
  return (
    <div className="ds-story-thread">
      {stage === 'server' ? (
        <MessageBubble
          direction="outgoing"
          body="I will meet you by the marked entrance."
          timestamp="2:28 PM"
          dateTime="2026-08-23T14:28:00.000Z"
          status="sent"
        />
      ) : (
        <PendingOutgoingMessageBubble
          body="I will meet you by the marked entrance."
          attachmentNames={[]}
          timestamp="2:28 PM"
          dateTime="2026-08-23T14:28:00.000Z"
          acknowledged={stage === 'acknowledged'}
        />
      )}
      <button
        type="button"
        className="btn btn-social btn-sm"
        onClick={() => setStage((current) => current === 'sending' ? 'acknowledged' : 'server')}
      >
        {stage === 'sending' ? 'Acknowledge message' : 'Reconcile server message'}
      </button>
    </div>
  )
}

export const SentPendingTransition: Story = {
  render: () => <DeliveryTransitionExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByLabelText('Sending message')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Acknowledge message' }))
    await expect(canvas.getByLabelText('Message sent')).toBeInTheDocument()
    expect(canvasElement.querySelector('.ds-message')?.getAttribute('data-pending')).toBe('true')
    await userEvent.click(canvas.getByRole('button', { name: 'Reconcile server message' }))
    expect(canvasElement.querySelector('.ds-message')?.hasAttribute('data-pending')).toBe(false)
  },
}

export const LongContentAt320px: Story = {
  render: () => (
    <div className="ds-story-thread">
      <MessageBubble
        direction="outgoing"
        body="This is a longer message with an uninterrupted-reference-number-123456789012345678901234567890 that must wrap on a compact 320 pixel screen without obscuring the timestamp, sent status, or adjacent report action."
        timestamp="2:29 PM"
        dateTime="2026-08-23T14:29:00.000Z"
        status="sent"
        actions={(
          <button type="button" className="direct-message-report" aria-label="Report message" title="Report message">
            <Flag size={14} aria-hidden="true" />
          </button>
        )}
      />
    </div>
  ),
}

export const PendingAttachmentOnly: Story = {
  render: () => (
    <div className="ds-story-thread">
      <PendingOutgoingMessageBubble
        body=""
        attachmentNames={['session-notes.pdf', 'arrival-map.png']}
        timestamp="2:30 PM"
        dateTime="2026-08-23T14:30:00.000Z"
      />
    </div>
  ),
}

export const AttachmentOnly: Story = {
  render: () => (
    <div className="ds-story-thread">
      <MessageBubble
        direction="incoming"
        timestamp="2:31 PM"
        dateTime="2026-08-23T14:31:00.000Z"
        attachments={(
          <button type="button" className="btn btn-neutral btn-sm">
            <Paperclip size={15} aria-hidden="true" />
            Open session-notes.pdf
          </button>
        )}
      />
    </div>
  ),
}

function ComposerStory() {
  const [value, setValue] = useState('')
  return (
    <CompactComposer
      value={value}
      canSubmit={Boolean(value.trim()) && value.trim().length <= 2000}
      onChange={setValue}
      onSubmit={() => setValue('')}
    />
  )
}

export const ComposerEmptyDisabled: Story = {
  render: () => <div className="ds-story-thread"><ComposerStory /></div>,
}
