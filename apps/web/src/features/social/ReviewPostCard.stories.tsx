import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { ReviewPostPreview } from './ReviewPostCard'

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

export const NoRatingChosen: Story = {
  args: { rating: 0, body: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText('0 out of 5 stars'),
    ).toBeVisible()
  },
}

export const WithPhotos: Story = {
  args: {
    body: undefined,
    imageUrls: [
      'https://placehold.co/400x400/png',
      'https://placehold.co/400x400/png?text=2',
      'https://placehold.co/400x400/png?text=3',
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The remote placeholders may not load in the test browser, so assert the
    // grid and the photos instead of their painted pixels.
    await expect(canvasElement.querySelector('.social-review-image-grid')).toBeTruthy()
    await expect(canvas.getAllByAltText("Photo shared with Robin Lee's review")).toHaveLength(3)
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
