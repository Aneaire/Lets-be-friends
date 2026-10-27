import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { CircleMarker } from './CircleMarker'

export const circleIcon =
  'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23C1519C"/%3E%3Ccircle cx="32" cy="32" r="14" fill="%23FFFFFF"/%3E%3C/svg%3E'

const meta = {
  title: 'Mobile/Circles/Circle marker',
  component: CircleMarker,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: { name: 'Cebu Coffee Friends' },
} satisfies Meta<typeof CircleMarker>

export default meta
type Story = StoryObj<typeof meta>

export const UploadedIcon: Story = {
  args: { iconUrl: circleIcon, joined: true, size: 32 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'Cebu Coffee Friends Circle icon' })).toBeInTheDocument()
    await expect(canvas.queryByRole('img', { name: 'Cebu Coffee Friends Circle mark' })).not.toBeInTheDocument()
  },
}

export const LogoFallback: Story = {
  args: { joined: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'Cebu Coffee Friends Circle mark' })).toBeInTheDocument()
    await expect(canvas.queryByRole('img', { name: 'Cebu Coffee Friends Circle icon' })).not.toBeInTheDocument()
  },
}

export const JoinedLogoFallback: Story = {
  args: { joined: true, size: 32 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'Cebu Coffee Friends Circle mark' })).toBeInTheDocument()
  },
}
