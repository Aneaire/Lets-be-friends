import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Pressable, StyleSheet } from 'react-native'

import { AttachmentMetaRow } from '@/design-system/molecules/AttachmentMetaRow'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

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
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
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

export const ComposerPreparingShowsBusy: Story = {
  render: () => {
    const [value, setValue] = useState('Preparing an attachment')

    return (
      <CompactComposer
        value={value}
        maxLength={2_100}
        canSubmit={false}
        preparing
        showAttach
        onAttachPress={() => undefined}
        onChange={setValue}
        onSubmit={() => undefined}
      />
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const preparingButton = canvas.getByRole('button', { name: 'Preparing' })
    await expect(preparingButton).toBeDisabled()
    await expect(preparingButton).toHaveAttribute('aria-busy', 'true')
    await expect(canvas.getByRole('button', { name: 'Attach files' })).toBeDisabled()
  },
}

export const ComposerWithAttachmentTray: Story = {
  render: () => {
    const [value, setValue] = useState('Here is the park map')

    return (
      <CompactComposer
        value={value}
        maxLength={2_100}
        canSubmit
        showAttach
        onAttachPress={() => undefined}
        onChange={setValue}
        onSubmit={() => undefined}
        attachments={(
          <AttachmentMetaRow
            name="park-map.jpg"
            detail="512.0 KiB · Original quality, no compression applied"
            state="success"
            actionLabel="Remove park-map.jpg"
            onAction={() => undefined}
          />
        )}
      />
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Attach files' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Send' })).toBeEnabled()
    await expect(canvas.getByLabelText('Selected files')).toBeVisible()
    await expect(canvas.getByText('park-map.jpg')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Remove park-map.jpg' })).toBeVisible()
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

function InlineReportAction() {
  const theme = useAppTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Report message"
      onPress={() => undefined}
      style={inlineStyles.report}
    >
      <AppText variant="caption" color={theme.colors.danger}>…</AppText>
    </Pressable>
  )
}

export const IncomingWithInlineReportAt320: Story = {
  render: () => (
    <MessageBubble
      direction="incoming"
      authorName="Alex Rivera"
      body="Would 2:30 PM work for the online session?"
      timestamp="2:24 PM"
      sideAction={<InlineReportAction />}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bubbleText = canvas.getByLabelText('Alex Rivera said: Would 2:30 PM work for the online session?')
    const report = canvas.getByRole('button', { name: 'Report message' })
    await expect(bubbleText).toBeVisible()
    await expect(report).toBeVisible()
    await expect(report).not.toHaveTextContent('Report message')
    expect(report.clientWidth).toBeGreaterThanOrEqual(44)
    expect(report.clientHeight).toBeGreaterThanOrEqual(44)
    const bubbleRect = bubbleText.getBoundingClientRect()
    const reportRect = report.getBoundingClientRect()
    expect(reportRect.left).toBeGreaterThan(bubbleRect.left)
    expect(reportRect.top).toBeGreaterThanOrEqual(bubbleRect.top - 8)
    expect(reportRect.top).toBeLessThan(bubbleRect.bottom + 8)
    expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1)
  },
}

function BoundedComposerStory() {
  const [value, setValue] = useState('')

  return (
    <CompactComposer
      value={value}
      maxLength={2_100}
      canSubmit={Boolean(value.trim())}
      showAttach
      onAttachPress={() => undefined}
      onChange={setValue}
      onSubmit={() => setValue('')}
    />
  )
}

export const ComposerCompactBoundsAt320: Story = {
  render: () => <BoundedComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Message' }) as HTMLElement
    const attach = canvas.getByRole('button', { name: 'Attach files' })
    const send = canvas.getByRole('button', { name: 'Send' })
    await expect(attach).toBeVisible()
    await expect(send).toBeVisible()
    expect(input.getAttribute('rows')).toBe('1')
    const initialHeight = input.clientHeight
    expect(initialHeight).toBeGreaterThanOrEqual(40)
    expect(initialHeight).toBeLessThanOrEqual(48)
    expect(input.clientWidth).toBeGreaterThan(canvasElement.clientWidth * 0.5)
    await userEvent.type(input, 'Line one\nLine two\nLine three\nLine four\nLine five\nLine six')
    await new Promise((resolve) => setTimeout(resolve, 150))
    const grownHeight = (canvas.getByRole('textbox', { name: 'Message' }) as HTMLElement).clientHeight
    expect(grownHeight).toBeGreaterThan(initialHeight)
    expect(grownHeight).toBeLessThanOrEqual(112)
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }))
    await new Promise((resolve) => setTimeout(resolve, 150))
    const resetInput = canvas.getByRole('textbox', { name: 'Message' }) as HTMLElement
    await expect(resetInput).toHaveValue('')
    expect(resetInput.clientHeight).toBeGreaterThanOrEqual(40)
    expect(resetInput.clientHeight).toBeLessThanOrEqual(48)
  },
}

const inlineStyles = StyleSheet.create({
  report: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
