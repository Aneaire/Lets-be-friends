import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import {
  NotificationCenterPresentation,
  type NotificationCenterItem,
} from './NotificationCenterPresentation'

const notifications: NotificationCenterItem[] = [
  {
    id: 'safety-report',
    title: 'Safety report received',
    body: 'The report is private and available only to authorized reviewers.',
    timeLabel: '4m',
    tone: 'danger',
    unread: true,
    group: 'attention',
  },
  {
    id: 'booking-accepted',
    title: 'Booking request accepted',
    body: 'Alex accepted your conversation practice request.',
    timeLabel: '18m',
    tone: 'social',
    unread: true,
    group: 'new',
  },
  {
    id: 'identity-approved',
    title: 'Identity verification approved',
    body: 'Your account can now request bookings.',
    timeLabel: '2d',
    tone: 'self',
    unread: false,
    group: 'earlier',
  },
]

const goBack = fn()
const markAllRead = fn(async () => undefined)
const openNotification = fn(async () => undefined)
const toggleRead = fn(async () => undefined)
const loadMore = fn()
const keepWorking = fn(() => new Promise<unknown>(() => undefined))
const rejectAction = fn(async () => {
  throw new Error('Network unavailable')
})

const meta = {
  title: 'Mobile/Notifications/Notification center',
  component: NotificationCenterPresentation,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  args: {
    notifications,
    onBack: goBack,
    onMarkAllRead: markAllRead,
    onOpen: openNotification,
    onToggleRead: toggleRead,
    onLoadMore: loadMore,
  },
} satisfies Meta<typeof NotificationCenterPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('NEEDS YOUR ATTENTION')).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', {
        name: /Unread notification\. Booking request accepted/,
      }),
    )
    await expect(openNotification).toHaveBeenCalledOnce()
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const Loading: Story = {
  args: { notifications: [], loadingFirstPage: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loading notifications')).toBeVisible()
    await expect(canvas.getByLabelText('Loading')).toBeVisible()
  },
}

export const Empty: Story = {
  args: { notifications: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('You are all caught up')).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'Mark all notifications read' }),
    ).toHaveAttribute('aria-disabled', 'true')
  },
}

export const RowBusy: Story = {
  args: { onToggleRead: keepWorking },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getAllByRole('button', { name: 'Mark notification read' })[0],
    )
    await expect(
      canvas.getAllByRole('button', { name: 'Mark notification read' })[0],
    ).toHaveAttribute('aria-busy', 'true')
    await expect(
      canvas.getByRole('button', {
        name: /Unread notification\. Safety report received/,
      }),
    ).toHaveAttribute('aria-disabled', 'true')
  },
}

export const MarkAllBusy: Story = {
  args: { onMarkAllRead: keepWorking },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Mark all notifications read' }),
    )
    await expect(
      canvas.getByRole('button', {
        name: 'Marking all notifications read',
      }),
    ).toHaveAttribute('aria-busy', 'true')
    await expect(
      canvas.getAllByRole('button', { name: 'Mark notification read' })[0],
    ).toHaveAttribute('aria-disabled', 'true')
  },
}

export const MarkAllFailure: Story = {
  args: { onMarkAllRead: rejectAction },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Mark all notifications read' }),
    )
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Notifications could not be marked read',
    )
  },
}

export const CanLoadMore: Story = {
  args: { pagination: 'can_load_more' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Load more notifications' }),
    )
    await expect(loadMore).toHaveBeenCalledOnce()
  },
}

export const LongContentAt320: Story = {
  parameters: { viewport: { defaultViewport: 'mobileTiny' } },
  args: {
    notifications: [
      {
        id: 'long-update',
        title: 'Your booking needs another identity check before it can continue',
        body: 'Open the booking to review what changed, why the check is required, and which details remain private from the other participant.',
        timeLabel: 'Yesterday at 11:48 PM',
        tone: 'self',
        unread: true,
        group: 'attention',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const SafetyDark: Story = {
  globals: { theme: 'dark' },
  args: { notifications: [notifications[0]] },
}
