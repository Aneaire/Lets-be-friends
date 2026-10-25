import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { View } from 'react-native'

import { PushOptInPromptPresentation } from './PushOptInPromptPresentation'

const enableNotifications = fn()
const dismissPrompt = fn()

const meta = {
  title: 'Mobile/Notifications/Push opt-in prompt',
  component: PushOptInPromptPresentation,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    onEnable: enableNotifications,
    onDismiss: dismissPrompt,
  },
  decorators: [
    (Story) => (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof PushOptInPromptPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('dialog', { name: 'Enable push notifications' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Enable notifications' }))
    await expect(enableNotifications).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Not now' }))
    await expect(dismissPrompt).toHaveBeenCalledOnce()
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}

export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Enabling notifications' })).toHaveAttribute('aria-busy', 'true')
    await expect(canvas.getByRole('button', { name: 'Not now' })).toHaveAttribute('aria-disabled', 'true')
  },
}

export const FailureRetry: Story = {
  args: { failed: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('could not be enabled')
    await userEvent.click(canvas.getByRole('button', { name: 'Enable notifications' }))
    await expect(enableNotifications).toHaveBeenCalledOnce()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('dialog', { name: 'Enable push notifications' })).toBeVisible()
  },
}
