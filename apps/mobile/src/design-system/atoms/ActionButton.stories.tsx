import type { Meta, StoryObj } from '@storybook/react-native-web-vite'

import { ActionButton } from './ActionButton'

const meta = {
  title: 'Mobile/Atoms/Action button',
  component: ActionButton,
  args: { label: 'Request a booking', onPress: () => undefined },
} satisfies Meta<typeof ActionButton>

export default meta
type Story = StoryObj<typeof meta>

export const Social: Story = {}
export const Self: Story = { args: { label: 'Save profile', intent: 'self' } }
export const Secondary: Story = { args: { label: 'View details', secondary: true } }
export const Disabled: Story = { args: { disabled: true } }
