import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { NotificationPreferencesPresentation } from './NotificationPreferencesPresentation'
import type { NotificationPreferencesView } from './notificationPreferences'

const preferences: NotificationPreferencesView = {
  socialReactions: true,
  socialComments: true,
  socialFollows: true,
  circleActivity: true,
  quietHoursEnabled: true,
  quietHoursStartMinute: 1320,
  quietHoursEndMinute: 420,
  timeZone: 'Asia/Manila',
  digestEnabled: false,
  digestHourMinute: 1080,
}

const onChange = fn()

const meta = {
  title: 'Features/Settings/Notification preferences',
  component: NotificationPreferencesPresentation,
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  args: {
    preferences,
    pending: '',
    error: '',
    onChange,
  },
  decorators: [
    (Story) => (
      <main className="settings-page">
        <div className="settings-stack">
          <Story />
        </div>
      </main>
    ),
  ],
} satisfies Meta<typeof NotificationPreferencesPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const SocialPreferences: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Notifications' })).toBeVisible()
    await expect(canvas.getByText('Bookings, messages, and safety notices are always delivered. You cannot turn them off here.')).toBeVisible()
    await expect(canvas.getByRole('switch', { name: 'Quiet hours' })).toHaveAttribute('aria-checked', 'true')
    await expect(canvas.getByLabelText('Quiet hours start time')).toHaveValue('22:00')
    await expect(canvas.getByLabelText('Daily digest time')).toBeDisabled()

    await userEvent.click(canvas.getByRole('switch', { name: 'Reactions' }))
    await expect(onChange).toHaveBeenCalledWith('socialReactions', { socialReactions: false })
  },
}

export const DigestEnabled: Story = {
  args: {
    preferences: {
      ...preferences,
      digestEnabled: true,
      digestHourMinute: 1080,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Social updates arrive in one daily summary at 6:00 PM.')).toBeVisible()
    await expect(canvas.getByLabelText('Daily digest time')).toBeEnabled()
  },
}

export const SaveError: Story = {
  args: { error: 'Your notification settings could not be saved.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Your notification settings could not be saved.')
  },
}

export const NarrowMobile: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
    await expect(within(canvasElement).getByRole('region', { name: 'Notifications' })).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark', viewport: { value: 'desktop', isRotated: false } },
}
