import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'

import { CircleCard } from './CircleCard'

const circleIcon = 'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23C1519C"/%3E%3Ccircle cx="32" cy="32" r="14" fill="%23FFFFFF"/%3E%3C/svg%3E'

const meta = {
  title: 'Mobile/Circles/Circle card',
  component: CircleCard,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof CircleCard>

export default meta
type Story = StoryObj<typeof meta>

export const OpenCircle: Story = {
  args: {
    circle: {
      _id: 'circle-language-exchange',
      name: 'Quezon City Language Exchange',
      purpose: 'Practice conversational languages in a respectful, low-pressure group.',
      category: 'Language exchange',
      memberCount: 18,
      mode: 'both',
      approximateArea: 'Quezon City',
      joinPolicy: 'open',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const openCircle = canvas.getByRole('button', { name: 'Open Quezon City Language Exchange Circle' })
    await expect(openCircle).toBeVisible()
    await expect(canvas.getByRole('img', { name: 'Quezon City Language Exchange Circle mark' })).toBeInTheDocument()
    await expect(canvas.getByText('Open join')).toBeVisible()
    await userEvent.click(openCircle)
  },
}

export const JoinedCircle: Story = {
  args: {
    circle: {
      _id: 'circle-coffee-walks',
      name: 'Weekend Coffee Walks',
      purpose: 'Plan relaxed public walks and cafe stops with nearby members.',
      category: 'Good company',
      memberCount: 9,
      mode: 'in_person',
      approximateArea: 'Makati',
      role: 'organizer',
      joinPolicy: 'approval_required',
      membershipState: 'active',
      iconUrl: circleIcon,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'Weekend Coffee Walks Circle icon' })).toBeInTheDocument()
    await expect(canvas.queryByRole('img', { name: 'Weekend Coffee Walks Circle mark' })).not.toBeInTheDocument()
    await expect(canvas.getByText('organizer')).toBeVisible()
    await expect(canvas.getByText('Good company · 9 members · Makati')).toBeVisible()
  },
}
