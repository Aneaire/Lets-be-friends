import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { NotificationPreferenceValues } from '@/notifications/notificationPreferences'

import { NotificationPreferencesPresentation } from './NotificationPreferencesPresentation'

const togglePreference = fn()
const selectTime = fn()

const defaults: NotificationPreferenceValues = {
  socialReactions: true,
  socialComments: true,
  socialFollows: false,
  circleActivity: true,
  quietHoursEnabled: false,
  quietHoursStartMinute: 1320,
  quietHoursEndMinute: 420,
  timeZone: 'Asia/Manila',
  digestEnabled: false,
  digestHourMinute: 1080,
}

const meta = {
  title: 'Mobile/Settings/Notification preferences',
  component: NotificationPreferencesPresentation,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    values: defaults,
    savingField: null,
    error: '',
    onToggle: togglePreference,
    onSelectTime: selectTime,
  },
} satisfies Meta<typeof NotificationPreferencesPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const reactions = canvas.getByRole('switch', { name: 'Reactions' })
    await expect(reactions).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(reactions)
    await expect(togglePreference).toHaveBeenCalledWith('socialReactions')

    const followers = canvas.getByRole('switch', { name: 'New followers' })
    await expect(followers).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(followers)
    await expect(togglePreference).toHaveBeenCalledWith('socialFollows')
  },
}

export const QuietHoursAndDigest: Story = {
  args: {
    values: { ...defaults, quietHoursEnabled: true, digestEnabled: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await expect(canvas.getByRole('button', { name: 'Quiet hours start, 10:00 PM' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Quiet hours end, 7:00 AM' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Daily digest time, 6:00 PM' })).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Quiet hours start, 10:00 PM' }))
    await userEvent.click(await page.findByRole('button', { name: '11:00 PM' }))
    await expect(selectTime).toHaveBeenCalledWith('quietHoursStartMinute', 1380)
  },
}

export const QuietHoursOff: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: /^Quiet hours start/ })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: /^Quiet hours end/ })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('switch', { name: 'Quiet hours' }))
    await expect(togglePreference).toHaveBeenCalledWith('quietHoursEnabled')
  },
}

export const Saving: Story = {
  args: { savingField: 'socialComments' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('switch', { name: 'Comments and replies' })).toHaveAttribute('aria-disabled', 'true')
  },
}

export const SaveError: Story = {
  args: { error: 'Notification preferences were not saved. Please try again.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('were not saved')
    await expect(canvas.getByRole('switch', { name: 'Reactions' })).toHaveAttribute('aria-checked', 'true')
  },
}

export const Loading: Story = {
  args: { values: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Loading notification preferences')).toBeVisible()
    await expect(canvas.queryByRole('switch')).not.toBeInTheDocument()
  },
}

export const Narrow320: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: { values: { ...defaults, quietHoursEnabled: true, digestEnabled: true } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}

export const Dark: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false }, theme: 'dark' },
  args: { values: { ...defaults, quietHoursEnabled: true, digestEnabled: true } },
}
