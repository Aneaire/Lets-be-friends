import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ShareSheet } from './ShareSheet'

const shareToFeed = fn(async () => undefined)
const shareLink = fn(async () => undefined)
const close = fn()

const meta = {
  title: 'Mobile/Organisms/Share sheet',
  component: ShareSheet,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    visible: true,
    title: 'Share post',
    previewLabel: 'Post by Alex Rivera',
    previewBody: 'Looking for someone to practice conversational English with this weekend.',
    onShareToFeed: shareToFeed,
    onShareLink: shareLink,
    onClose: close,
  },
} satisfies Meta<typeof ShareSheet>

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(canvas.getByRole('dialog', { name: 'Share post' })).toBeInTheDocument()
    await expect(canvas.getByText('Post by Alex Rivera')).toBeVisible()
    await userEvent.type(canvas.getByRole('textbox', { name: 'Add a note to your share' }), 'Worth a look')
    await userEvent.click(canvas.getByRole('button', { name: 'Share to feed' }))
    await expect(shareToFeed).toHaveBeenCalledWith('Worth a look')
    await expect(close).toHaveBeenCalled()
  },
}

export const ShareLink: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: 'Share link' }))
    await expect(shareLink).toHaveBeenCalledTimes(1)
  },
}
