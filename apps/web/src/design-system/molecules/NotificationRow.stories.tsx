import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { NotificationRow } from './NotificationRow'

const openNotification = fn(async () => undefined)
const toggleNotification = fn(async () => undefined)
const keepUpdating = fn(() => new Promise<unknown>(() => undefined))
const rejectUpdate = fn(async () => {
  throw new Error('Network unavailable')
})

const meta = {
  title: 'Web/Molecules/Notification row',
  component: NotificationRow,
  globals: { viewport: 'mobileDefault' },
  args: {
    title: 'Booking request accepted',
    body: 'Alex accepted your conversation practice request.',
    timeLabel: '4 minutes ago',
    dateTime: '2026-08-24T00:30:00.000Z',
    tone: 'social',
    unread: true,
    onOpen: openNotification,
    onToggle: toggleNotification,
  },
} satisfies Meta<typeof NotificationRow>

export default meta
type Story = StoryObj<typeof meta>

export const Unread: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Open notification: Booking request accepted',
      }),
    )
    await expect(openNotification).toHaveBeenCalledOnce()
  },
}

export const Read: Story = {
  args: { unread: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', {
        name: 'Mark Booking request accepted unread',
      }),
    ).toBeVisible()
  },
}

export const ToggleBusy: Story = {
  args: { onToggle: keepUpdating },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Mark Booking request accepted read',
      }),
    )
    const toggle = canvas.getByRole('button', {
      name: 'Mark Booking request accepted read',
    })
    await expect(toggle).toHaveAttribute('aria-busy', 'true')
    await expect(toggle).toHaveTextContent('Updating…')
    await expect(
      canvas.getByRole('button', {
        name: 'Open notification: Booking request accepted',
      }),
    ).toBeDisabled()
  },
}

export const ActionFailure: Story = {
  args: { onToggle: rejectUpdate },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Mark Booking request accepted read',
      }),
    )
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'The notification could not be updated. Try again.',
    )
  },
}

export const LongCopyNarrow: Story = {
  globals: { viewport: 'mobileSmall' },
  args: {
    title: 'Your booking needs another identity check before it can continue',
    body: 'Open the booking to review what changed, why the check is required, and which details remain private from the other participant.',
    timeLabel: 'Yesterday at 11:48 PM',
    tone: 'self',
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const SafetyDark: Story = {
  globals: { theme: 'dark', viewport: 'mobileDefault' },
  args: {
    title: 'Safety report received',
    body: 'The report is private and available only to authorized reviewers.',
    tone: 'danger',
  },
}
