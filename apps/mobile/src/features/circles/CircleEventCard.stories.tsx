import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { CircleEventCard } from './CircleEventCard'

const meta = {
  title: 'Mobile/Circles/Circle event card',
  component: CircleEventCard,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof CircleEventCard>

export default meta
type Story = StoryObj<typeof meta>

const startsAt = Date.now() + 3 * 24 * 60 * 60 * 1000

export const ScheduledEvent: Story = {
  args: {
    event: {
      _id: 'event-coffee-crawl',
      title: 'Weekend coffee crawl',
      details: 'Meet at a public cafe, walk to two nearby spots, and keep the group together.',
      startsAt,
      location: 'Ayala Center Cebu',
      mode: 'in_person',
      state: 'scheduled',
      organizerDisplayName: 'Maya',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Weekend coffee crawl')).toBeVisible()
    await expect(canvas.getByText('Organized by Maya')).toBeVisible()
  },
}

export const CancelledOnlineEvent: Story = {
  args: {
    event: {
      _id: 'event-online-chat',
      title: 'Online welcome chat',
      details: 'A short online session for new members to meet the hosts.',
      startsAt,
      mode: 'online',
      state: 'cancelled',
      organizerDisplayName: 'Ravi',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Cancelled')).toBeVisible()
    await expect(canvas.getByText('Online')).toBeVisible()
  },
}
