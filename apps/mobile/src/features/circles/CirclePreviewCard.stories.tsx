import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'

import { CirclePreviewCard } from './CirclePreviewCard'

const circleIcon = 'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%231093ED"/%3E%3Ccircle cx="32" cy="32" r="14" fill="%23FFFFFF"/%3E%3C/svg%3E'

const meta = {
  title: 'Mobile/Circles/Circle preview card',
  component: CirclePreviewCard,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof CirclePreviewCard>

export default meta
type Story = StoryObj<typeof meta>

export const OpenPreview: Story = {
  args: {
    circle: {
      _id: 'circle-preview-coffee',
      name: 'Cebu Coffee Friends',
      purpose: 'Meet fellow coffee lovers for relaxed public cafe sessions.',
      category: 'Coffee',
      memberCount: 24,
      mode: 'both',
      approximateArea: 'Cebu City',
      iconUrl: circleIcon,
      hostDisplayName: 'Maya',
      joinPolicy: 'open',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const preview = canvas.getByRole('button', { name: 'Preview Cebu Coffee Friends Circle' })
    await expect(preview).toBeVisible()
    await expect(canvas.getByRole('img', { name: 'Cebu Coffee Friends Circle icon' })).toBeInTheDocument()
    await expect(canvas.getByText('Open join')).toBeVisible()
    await expect(canvas.getByText('Hosted by Maya')).toBeVisible()
    await userEvent.click(preview)
  },
}

export const ApprovalPreview: Story = {
  args: {
    circle: {
      _id: 'circle-preview-walks',
      name: 'Weekend Walks',
      purpose: 'Plan relaxed public walks with nearby members.',
      category: 'Good company',
      memberCount: 1,
      mode: 'in_person',
      approximateArea: 'Makati',
      hostDisplayName: null,
      joinPolicy: 'approval_required',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'Weekend Walks Circle mark' })).toBeVisible()
    await expect(canvas.getByText('Good company · 1 member · Makati')).toBeVisible()
    await expect(canvas.getByText('Hosted by Circle host')).toBeVisible()
  },
}
