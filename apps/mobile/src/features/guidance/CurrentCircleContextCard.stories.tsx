import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { CurrentCircleContextPresentation } from './CurrentCircleContextCard'

const meta = {
  title: 'Mobile/Guidance/Current circle context card',
  component: CurrentCircleContextPresentation,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof CurrentCircleContextPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  args: { mine: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loading your circles...')).toBeVisible()
  },
}

export const Empty: Story = {
  args: { mine: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Your current circle')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Discover circles' })).toBeVisible()
  },
}

export const WithCircles: Story = {
  args: {
    mine: [
      { _id: 'circle-coffee', name: 'Cebu Coffee Friends', memberCount: 24, mode: 'both', role: 'host', membershipState: 'active', iconUrl: 'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23C1519C"/%3E%3C/svg%3E' },
      { _id: 'circle-walks', name: 'Weekend Walks', memberCount: 12, mode: 'in_person', membershipState: 'active' },
      { _id: 'circle-requested', name: 'Pending Circle', memberCount: 3, mode: 'online', membershipState: 'requested' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Open Cebu Coffee Friends Circle' })).toBeVisible()
    await expect(canvas.getByRole('img', { name: 'Cebu Coffee Friends Circle icon' })).toBeInTheDocument()
    await expect(canvas.getByRole('img', { name: 'Weekend Walks Circle mark' })).toBeVisible()
    await expect(canvas.getByText('24 members · Online and in person · host')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Open Weekend Walks Circle' })).toBeVisible()
    await expect(canvas.queryByText('Pending Circle')).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'See all circles' })).toBeVisible()
    await expect(canvas.getByText('See all (2)')).toBeVisible()
  },
}
