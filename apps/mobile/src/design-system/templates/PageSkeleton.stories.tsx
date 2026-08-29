import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { PageSkeleton } from './PageSkeleton'

const meta = {
  title: 'Mobile/Templates/Page skeletons',
  component: PageSkeleton,
  parameters: {
    mobileCanvasPadding: 0,
    viewport: { defaultViewport: 'mobileDefault' },
  },
  args: { variant: 'publicProfile' },
} satisfies Meta<typeof PageSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const PublicProfile: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('progressbar', { name: 'Loading public profile' })).toBeVisible()
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}

export const Explore: Story = {
  args: { variant: 'explore' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('progressbar', { name: 'Loading Explore' })).toBeVisible()
  },
}

export const Conversation: Story = {
  args: { variant: 'conversation' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('progressbar', { name: 'Loading messages' })).toBeVisible()
  },
}

export const ProfileForm: Story = {
  args: { variant: 'profileForm' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('progressbar', { name: 'Loading profile form' })).toBeVisible()
  },
}

export const Wallet: Story = {
  args: { variant: 'wallet' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('progressbar', { name: 'Loading booking wallet' })).toBeVisible()
  },
}
