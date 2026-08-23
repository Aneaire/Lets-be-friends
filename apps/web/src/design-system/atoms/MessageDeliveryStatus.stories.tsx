import type { Meta, StoryObj } from '@storybook/react-vite'

import { MessageDeliveryStatus } from './MessageDeliveryStatus'

const meta = {
  title: 'Atoms/Message delivery status',
  component: MessageDeliveryStatus,
  args: { state: 'sent' },
} satisfies Meta<typeof MessageDeliveryStatus>

export default meta
type Story = StoryObj<typeof meta>

export const Sent: Story = {}
export const Sending: Story = { args: { state: 'sending' } }
