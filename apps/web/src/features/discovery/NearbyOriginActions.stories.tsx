import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

import { NearbyOriginActions } from './NearbyOriginActions'

const meta = {
  title: 'Features/Discovery/Nearby origin actions',
  component: NearbyOriginActions,
  parameters: { layout: 'centered' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    originMode: null,
    onUseCurrentLocation: fn(),
    onBeginTravelPin: fn(),
  },
} satisfies Meta<typeof NearbyOriginActions>

export default meta
type Story = StoryObj<typeof meta>

export const NoOriginSelected: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Use my location' })).toHaveAttribute('aria-pressed', 'false')
    await expect(canvas.getByRole('button', { name: 'Place a pin' })).toHaveAttribute('aria-pressed', 'false')
  },
}

export const CurrentLocationSelected: Story = {
  args: { originMode: 'device' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Use my location' })).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByRole('button', { name: 'Place a pin' })).toHaveAttribute('aria-pressed', 'false')
  },
}

export const TravelPinSelected: Story = {
  args: { originMode: 'custom' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Place a pin' }),
    ).toHaveAttribute('aria-pressed', 'true')
  },
}

export const NarrowDark: Story = {
  args: { originMode: 'device' },
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
}
