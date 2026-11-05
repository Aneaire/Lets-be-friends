import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, within } from 'storybook/test'

import { ReferralCodeCard } from './ReferralCodeCard'

const meta = {
  title: 'Features/Referral/Referral code card',
  component: ReferralCodeCard,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    busy: false,
    error: '',
    notice: '',
    onSubmit: fn(),
    onSkip: fn(),
  },
} satisfies Meta<typeof ReferralCodeCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Have a friend's code/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Dismiss' })).toBeVisible()
  },
}

export const ErrorState: Story = {
  args: { error: 'We could not add this code. Check it and try again.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
}
