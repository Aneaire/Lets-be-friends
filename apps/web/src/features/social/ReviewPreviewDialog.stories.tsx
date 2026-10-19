import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { ReviewPostPreview, ReviewPreviewDialog } from './ReviewPreviewDialog'

const meta = {
  title: 'Features/Social/Review preview',
  component: ReviewPostPreview,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: {
    authorName: 'Robin Lee',
    companionName: 'Jordan Companion',
    rating: 5,
    body: 'A thoughtful walk and an easy conversation. We planned the route in chat and it worked perfectly.',
  },
} satisfies Meta<typeof ReviewPostPreview>

export default meta
type Story = StoryObj<typeof meta>

export const WithNote: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('article', { name: 'Review preview' })).toBeVisible()
    await expect(canvas.getByText(/Shared an experience with Jordan Companion/)).toBeVisible()
    await expect(canvas.getByLabelText('5 out of 5 stars')).toBeVisible()
    await expect(canvas.getByText(/A thoughtful walk and an easy conversation/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Appreciate post' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Share post' })).toBeVisible()
  },
}

export const RatingOnly: Story = {
  args: { body: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('5 out of 5 stars')).toBeVisible()
    await expect(canvas.getByText(/Shared an experience with Jordan Companion/)).toBeVisible()
  },
}

export const WithPhoto: Story = {
  args: {
    body: undefined,
    imageUrl: 'https://placehold.co/640x480/png',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByAltText("Photo shared with Robin Lee's review")).toBeVisible()
  },
}

export const NarrowDarkRatingOnly: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  args: { body: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Shared an experience with Jordan Companion/),
    ).toBeVisible()
  },
}

export const InsideTheDialog: Story = {
  render: () => (
    <ReviewPreviewDialog
      open
      onClose={() => undefined}
      authorName="Robin Lee"
      companionName="Jordan Companion"
      rating={5}
      body="A thoughtful walk and an easy conversation."
    />
  ),
  play: async () => {
    const dialog = await within(document.body).findByRole('dialog', { name: 'How your review will look' })
    await expect(within(dialog).getByRole('article', { name: 'Review preview' })).toBeVisible()
    await expect(within(dialog).getByText(/Shared an experience with Jordan Companion/)).toBeVisible()
  },
}

export const InsideTheDialogLight: Story = {
  ...InsideTheDialog,
  globals: { theme: 'light', viewport: { value: 'desktop', isRotated: false } },
}
