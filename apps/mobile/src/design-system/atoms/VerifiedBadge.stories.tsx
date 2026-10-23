import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { VerifiedBadge } from './VerifiedBadge'

const meta = {
  title: 'Mobile/Atoms/Verified badge',
  component: VerifiedBadge,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof VerifiedBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Identity verified')).toBeInTheDocument()
  },
}
