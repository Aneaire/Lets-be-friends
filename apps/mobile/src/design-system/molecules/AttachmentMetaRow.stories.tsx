import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { AttachmentMetaRow } from './AttachmentMetaRow'

const lightTheme = { theme: 'light' }
const darkTheme = { theme: 'dark' }

const meta = {
  title: 'Mobile/Molecules/Attachment metadata row',
  component: AttachmentMetaRow,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  args: {
    name: 'session-notes.pdf',
    detail: '1.5 MiB · Open private attachment',
    state: 'default',
    actionRole: 'link',
    actionLabel: 'Open private attachment session-notes.pdf',
    onAction: fn(),
  },
} satisfies Meta<typeof AttachmentMetaRow>

export default meta
type Story = StoryObj<typeof meta>

export const AvailableFile: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('link', { name: 'Open private attachment session-notes.pdf' }))
    await expect(args.onAction).toHaveBeenCalledOnce()
  },
}

export const Uploading: Story = {
  args: {
    name: 'shared-photo.jpg',
    detail: 'Preparing secure upload',
    state: 'progress',
    busy: true,
    actionRole: 'button',
    actionLabel: 'shared-photo.jpg upload in progress',
  },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: 'shared-photo.jpg upload in progress' })
    await expect(row).toHaveAttribute('aria-disabled', 'true')
    await expect(row).toHaveAttribute('aria-busy', 'true')
  },
}

export const Disabled: Story = {
  args: {
    detail: 'Available after the booking is confirmed',
    disabled: true,
    actionRole: 'button',
    actionLabel: 'Attachment unavailable until booking confirmation',
  },
  play: async ({ canvasElement, args }) => {
    const row = within(canvasElement).getByRole('button', { name: 'Attachment unavailable until booking confirmation' })
    await expect(row).toHaveAttribute('aria-disabled', 'true')
    row.click()
    await expect(args.onAction).not.toHaveBeenCalled()
  },
}

export const Uploaded: Story = {
  args: {
    detail: 'Upload complete',
    state: 'success',
    onAction: undefined,
  },
}

export const SecureLinkUnavailable: Story = {
  args: {
    detail: 'Secure link unavailable',
    state: 'danger',
    onAction: undefined,
  },
}

export const LongNameAt320: Story = {
  name: 'Long filename at 320 px / light',
  globals: lightTheme,
  args: {
    name: 'completeonlinesessionnotesandaccessibilityfollowupdocumentversion12.pdf',
    detail: '14.8 MiB · Open private attachment',
    actionLabel: 'Open private attachment completeonlinesessionnotesandaccessibilityfollowupdocumentversion12.pdf',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const attachment = canvas.getByRole('link', {
      name: 'Open private attachment completeonlinesessionnotesandaccessibilityfollowupdocumentversion12.pdf',
    })
    await expect(attachment).toBeVisible()
    await expect(canvas.getByText('14.8 MiB · Open private attachment')).toBeVisible()
    expect(attachment.scrollWidth).toBeLessThanOrEqual(attachment.clientWidth)
    expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
    await userEvent.click(attachment)
    await expect(args.onAction).toHaveBeenCalledOnce()
  },
}

export const LongNameAt320Dark: Story = {
  ...LongNameAt320,
  name: 'Long filename at 320 px / dark',
  globals: darkTheme,
}
