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
export const Neutral: Story = { args: { label: 'Continue', intent: 'neutral' } }
export const Secondary: Story = { args: { label: 'View details', intent: 'neutral', secondary: true } }
export const Danger: Story = { args: { label: 'Delete', intent: 'danger' } }
export const Disabled: Story = { args: { disabled: true } }
