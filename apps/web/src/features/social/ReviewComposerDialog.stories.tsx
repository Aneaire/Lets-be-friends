import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ReviewComposerView } from './ReviewComposerDialog'

const meta = {
  title: 'Features/Social/Review composer',
  component: ReviewComposerView,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: {
    authorName: 'Robin Lee',
    companionName: 'Jordan Companion',
    rating: undefined,
    body: '',
    photos: [],
    busy: false,
    dragging: false,
    error: '',
    onRate: () => undefined,
    onBodyChange: () => undefined,
    onChooseFiles: () => undefined,
    onRemovePhoto: () => undefined,
    onDraggingChange: () => undefined,
  },
} satisfies Meta<typeof ReviewComposerView>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('article', { name: 'Write your review' })).toBeVisible()
    await expect(canvas.getByText('Tap a star to rate the experience.')).toBeVisible()
    await expect(canvas.getByRole('radio', { name: '5 stars' })).toBeVisible()
    await expect(canvas.getByText('Drag photos here, or choose files')).toBeVisible()
  },
}

export const RatingOnly: Story = {
  args: { rating: 5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('5 of 5, Outstanding')).toBeVisible()
    await expect(canvas.getByRole('radio', { name: '5 stars' })).toHaveAttribute('aria-checked', 'true')
    await expect(canvas.queryByText('Tap a star to rate the experience.')).toBeNull()
  },
}

export const WrittenWithPhotos: Story = {
  args: {
    rating: 4,
    body: 'A relaxed coffee walk. They planned the route in chat and kept it easy to follow.',
    photos: [
      { key: 'one', url: 'https://placehold.co/400x400/png', name: 'walk-1.png' },
      { key: 'two', url: 'https://placehold.co/400x400/png?text=2', name: 'walk-2.png' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Selected photos').children).toHaveLength(2)
    await expect(canvas.getByText('Add more photos')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Remove walk-1.png' })).toBeVisible()
  },
}

export const StarIsClickable: Story = {
  args: { onRate: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: '3 stars' }))
    await expect(args.onRate).toHaveBeenCalledWith(3)
  },
}

export const DraggingPhotos: Story = {
  args: { rating: 5, dragging: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Drop to add photos'),
    ).toBeVisible()
  },
}

export const WithError: Story = {
  args: { rating: 3, error: 'notes.txt is not a JPEG, PNG, or WebP image.' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('alert'),
    ).toHaveTextContent('is not a JPEG, PNG, or WebP image')
  },
}

export const NarrowDark: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  args: { rating: 5, body: 'Good company and an easy conversation.' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('article', { name: 'Write your review' }),
    ).toBeVisible()
  },
}
