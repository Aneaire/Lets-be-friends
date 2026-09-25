import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'

import { CircleCard } from './CircleCard'

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
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('organizer')).toBeVisible()
    await expect(canvas.getByText('Good company · 9 members · Makati')).toBeVisible()
  },
}
