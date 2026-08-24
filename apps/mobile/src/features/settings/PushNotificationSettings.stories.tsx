import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { PushNotificationSettingsPresentation } from './PushNotificationSettingsPresentation'

const enablePush = fn()
const disablePush = fn()
const openSettings = fn()
const retryDisable = fn()
const retryAvailability = fn()

const meta = {
  title: 'Mobile/Settings/Push notifications',
  component: PushNotificationSettingsPresentation,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  args: {
    state: {
      status: 'disabled',
      message: 'Push notifications are off for this account on this device.',
    },
    onEnable: enablePush,
    onDisable: disablePush,
    onOpenSettings: openSettings,
    onRetryDisable: retryDisable,
    onRetryAvailability: retryAvailability,
  },
} satisfies Meta<typeof PushNotificationSettingsPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const Disabled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Enable push notifications' }),
    )
    await expect(enablePush).toHaveBeenCalledOnce()
  },
}

export const Enabled: Story = {
  args: {
    state: {
      status: 'enabled',
      message: 'Generic account updates may appear on this device.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Turn off push notifications' }),
    )
    await expect(disablePush).toHaveBeenCalledOnce()
  },
}

export const Loading: Story = {
  args: {
    state: {
      status: 'loading',
      message: 'Checking notification availability.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByLabelText('Checking notification availability'),
    ).toBeVisible()
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument()
  },
}

export const PermissionDenied: Story = {
  args: {
    state: {
      status: 'denied',
      message: 'Notifications are blocked. Open device settings to allow them.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Open device settings' }),
    )
    await expect(openSettings).toHaveBeenCalledOnce()
  },
}

export const PendingServerCleanup: Story = {
  args: {
    state: {
      status: 'pending_disable',
      message: 'Push was turned off on this device, but server cleanup still needs to finish.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'server cleanup still needs to finish',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Retry turning off' }),
    )
    await expect(retryDisable).toHaveBeenCalledOnce()
  },
}

export const AvailabilityErrorAt320: Story = {
  parameters: { viewport: { defaultViewport: 'mobileTiny' } },
  args: {
    state: {
      status: 'availability_error',
      message: 'Notification availability is taking too long to load. Check your connection and try again.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Check notification availability again',
      }),
    )
    await expect(retryAvailability).toHaveBeenCalledOnce()
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const UpdateError: Story = {
  args: {
    state: {
      status: 'error',
      message: 'Push notification settings could not be updated. Please try again.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'could not be updated',
    )
    await expect(
      canvas.getByRole('button', { name: 'Enable push notifications' }),
    ).toBeVisible()
  },
}

export const Unavailable: Story = {
  args: {
    state: {
      status: 'unavailable',
      message: 'Push notifications require a physical iOS or Android development build.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument()
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const EnabledDark: Story = {
  globals: { theme: 'dark' },
  args: {
    state: {
      status: 'enabled',
      message: 'Generic account updates may appear on this device.',
    },
  },
}
