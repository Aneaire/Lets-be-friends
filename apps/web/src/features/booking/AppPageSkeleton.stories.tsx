import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { AppPageSkeleton, BookingsViewSkeleton } from './AppPageSkeleton'

const meta = {
  title: 'Features/Booking/Loading skeleton',
  component: AppPageSkeleton,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
} satisfies Meta<typeof AppPageSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const LoadingWorkspace: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading your bookings.')
    await expect(canvasElement.querySelector('.workspace')).toBeTruthy()
    await expect(canvasElement.querySelectorAll('.booking-calendar-day')).toHaveLength(42)
  },
}

export const NarrowDark: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('status'),
    ).toHaveTextContent('Loading your bookings.')
  },
}

export const BookingsOnly: Story = {
  render: () => <BookingsViewSkeleton />,
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
}
