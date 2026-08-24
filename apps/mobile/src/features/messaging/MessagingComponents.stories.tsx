import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { AttachmentMetaRow } from '@/design-system/molecules/AttachmentMetaRow'

import { CompactComposer } from './CompactComposer'
import { MessageBubble } from './MessageBubble'

const submitMessage = fn()
const openAttachment = fn()
const lightTheme = { theme: 'light' }
const darkTheme = { theme: 'dark' }

function ComposerStory({
  initialValue = '',
  sending = false,
  disabled = false,
}: {
  initialValue?: string
  sending?: boolean
  disabled?: boolean
}) {
  const [value, setValue] = useState(initialValue)

  return (
    <CompactComposer
      value={value}
      maxLength={2_100}
      sending={sending}
      disabled={disabled}
      onChange={setValue}
      onSubmit={() => {
        submitMessage(value)
        setValue('')
      }}
    />
  )
}

function OverLimitComposerStory() {
  const [value, setValue] = useState('a'.repeat(2_001))

  return (
    <CompactComposer
      value={value}
      maxLength={2_100}
      disabled={value.length > 2_000}
      onChange={setValue}
      onSubmit={() => undefined}
    />
  )
}

const meta = {
  title: 'Mobile/Organisms/Messaging thread',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Incoming: Story = {
  name: 'Incoming / light',
  globals: lightTheme,
  render: () => (
    <MessageBubble
      direction="incoming"
      authorName="Alex Rivera"
      body="Would 2:30 PM work for the online session?"
      timestamp="2:24 PM"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Alex Rivera said: Would 2:30 PM work for the online session?')).toBeVisible()
    await expect(canvas.getByLabelText('Sent 2:24 PM')).toBeVisible()
  },
}

export const IncomingDark: Story = {
  ...Incoming,
  name: 'Incoming / dark',
  globals: darkTheme,
}

export const Outgoing: Story = {
  name: 'Outgoing / light',
  globals: lightTheme,
  render: () => (
    <MessageBubble
      direction="outgoing"
      body="Yes. I will send the final booking details here."
      timestamp="2:26 PM"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('You said: Yes. I will send the final booking details here.')).toBeVisible()
    await expect(canvas.getByLabelText('Sent 2:26 PM')).toBeVisible()
  },
}

export const OutgoingDark: Story = {
  ...Outgoing,
  name: 'Outgoing / dark',
  globals: darkTheme,
}

export const PendingLongContent: Story = {
  name: 'Pending long content / light',
  globals: lightTheme,
  render: () => (
    <MessageBubble
      direction="outgoing"
      body="This longer message shows compact wrapping on a small device while retaining a safe reading width."
      timestamp="2:27 PM"
      pending
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('You said: This longer message shows compact wrapping on a small device while retaining a safe reading width.')).toBeVisible()
    await expect(canvas.getByLabelText('Sending, 2:27 PM')).toBeVisible()
  },
}

export const PendingLongContentDark: Story = {
  ...PendingLongContent,
  name: 'Pending long content / dark',
  globals: darkTheme,
}

export const AttachmentOnly: Story = {
  name: 'Long attachment only at 320 px / light',
  globals: lightTheme,
  render: () => (
    <MessageBubble
      direction="incoming"
      authorName="Alex Rivera"
      timestamp="2:28 PM"
      attachments={(
        <AttachmentMetaRow
          name="completeonlinesessionnotesandaccessibilityfollowupdocumentversion12.pdf"
          detail="14.8 MiB · Open private attachment"
          actionRole="link"
          actionLabel="Open private attachment completeonlinesessionnotesandaccessibilityfollowupdocumentversion12.pdf"
          onAction={openAttachment}
        />
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    openAttachment.mockClear()
    const canvas = within(canvasElement)
    const attachment = canvas.getByRole('link', {
      name: 'Open private attachment completeonlinesessionnotesandaccessibilityfollowupdocumentversion12.pdf',
    })
    await expect(canvas.getByLabelText('Alex Rivera sent an attachment')).toBeVisible()
    await expect(attachment).toBeVisible()
    await expect(canvas.getByText('14.8 MiB · Open private attachment')).toBeVisible()
    await expect(canvas.getByLabelText('Sent 2:28 PM')).toBeVisible()
    expect(attachment.scrollWidth).toBeLessThanOrEqual(attachment.clientWidth)
    expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
    await userEvent.click(attachment)
    await expect(openAttachment).toHaveBeenCalledOnce()
  },
}

export const AttachmentOnlyDark: Story = {
  ...AttachmentOnly,
  name: 'Long attachment only at 320 px / dark',
  globals: darkTheme,
}

export const ComposerEmptyDisabled: Story = {
  render: () => <ComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Send' })).toBeDisabled()
  },
}

export const ComposerSendsExactlyOnce: Story = {
  render: () => <ComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Message' })
    await userEvent.type(input, 'See you at 2:30 PM')
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }))
    await expect(submitMessage).toHaveBeenCalledTimes(1)
    await expect(submitMessage).toHaveBeenCalledWith('See you at 2:30 PM')
    await expect(input).toHaveValue('')
  },
}

export const ComposerSendingLocksDraft: Story = {
  render: () => <ComposerStory initialValue="Message being sent" sending />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Message' })
    const sendButton = canvas.getByRole('button', { name: 'Send' })
    await expect(input).toHaveAttribute('aria-disabled', 'true')
    await expect(sendButton).toBeDisabled()
    await expect(sendButton).toHaveAttribute('aria-busy', 'true')
  },
}

export const ComposerOverLimitAllowsCorrection: Story = {
  render: () => <OverLimitComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Message' })
    const sendButton = canvas.getByRole('button', { name: 'Send' })
    await expect(input).not.toHaveAttribute('aria-disabled', 'true')
    await expect(sendButton).toBeDisabled()
    await userEvent.clear(input)
    await userEvent.type(input, 'Shortened message')
    await expect(sendButton).toBeEnabled()
  },
}
