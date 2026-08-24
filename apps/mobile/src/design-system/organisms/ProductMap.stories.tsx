import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { ProductMap } from './ProductMap'

const meta = {
  title: 'Mobile/Organisms/Product map',
  component: ProductMap,
  parameters: { viewport: { defaultViewport: 'mobileDefault' } },
  args: {
    center: { latitude: 14.5995, longitude: 120.9842 },
    radiusKm: 5,
    points: [
      { id: 'alex', name: 'Alex Rivera', latitude: 14.6042, longitude: 120.9822 },
      { id: 'morgan', name: 'Morgan Lee', latitude: 14.5928, longitude: 120.9891 },
    ],
  },
} satisfies Meta<typeof ProductMap>

export default meta
type Story = StoryObj<typeof meta>

export const WebFallback: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Map preview is available in the iOS and Android app.')).toBeVisible()
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
}
