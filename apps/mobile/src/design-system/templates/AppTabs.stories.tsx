import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { AppTabsPresentation } from './AppTabsPresentation'

const meta = {
  title: 'Mobile/Templates/App tabs',
  component: AppTabsPresentation,
  parameters: {
    mobileCanvasPadding: 0,
    viewport: { defaultViewport: 'mobileDefault' },
  },
} satisfies Meta<typeof AppTabsPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const SignedOut: Story = {
  args: { signedIn: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tab', { name: 'Home tab' })).toBeVisible()
    await expect(canvas.getByRole('tab', { name: 'Explore Companions tab' })).toBeVisible()
    await expect(canvas.queryByRole('tab', { name: 'Bookings tab' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('tab', { name: /Messages tab/ })).not.toBeInTheDocument()
    await expect(canvas.getByRole('tab', { name: 'Profile and settings tab' })).toBeVisible()
  },
}

export const SignedIn: Story = {
  args: { signedIn: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('tab')).toHaveLength(5)
    await expect(canvas.getByRole('tab', { name: 'Messages tab' })).toBeVisible()
  },
}

export const UnreadMessages: Story = {
  args: { signedIn: true, unreadCount: 12 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('tab', { name: 'Messages tab, 12 unread' })).toHaveTextContent('12')
  },
}

export const LargeUnreadCount: Story = {
  args: { signedIn: true, unreadCount: 128 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('tab', { name: 'Messages tab, 128 unread' })).toBeVisible()
  },
}
