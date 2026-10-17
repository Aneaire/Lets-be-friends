import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, within } from 'storybook/test'

import { VerifiedPresentation } from './VerifiedPresentation'

const meta = {
  title: 'Mobile/Verification/Verified presentation',
  component: VerifiedPresentation,
  args: {
    approved: true,
    verificationLabel: 'Identity verified',
    verificationDetail: 'Your current identity approval is active for member booking.',
    onBack: fn(),
    onNavigate: fn(),
  },
} satisfies Meta<typeof VerifiedPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const Approved: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('You are verified. Start making friends.')).toBeTruthy()
    await expect(canvas.getByText('Three easy ways to begin')).toBeTruthy()
  },
}

export const NotApproved: Story = {
  args: {
    approved: false,
    verificationLabel: 'Identity review pending',
    verificationDetail: 'Your latest identity check is still in progress and is not approved yet.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('You are verified. Start making friends.')).toBeNull()
    await expect(canvas.getByText('Identity review pending')).toBeTruthy()
  },
}
