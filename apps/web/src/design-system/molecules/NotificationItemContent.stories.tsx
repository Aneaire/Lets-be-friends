import type { Meta, StoryObj } from '@storybook/react-vite'
import { NotificationItemContent } from './NotificationItemContent'

const meta = {
  title: 'Web/Molecules/Notification item content',
  component: NotificationItemContent,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  decorators: [
    (Story) => (
      <button
        type="button"
        style={{
          display: 'block',
          width: 'min(100%, 32rem)',
          minHeight: 'var(--density-touch, 2.75rem)',
          padding: 0,
          border: 0,
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          background: 'transparent',
          color: 'inherit',
          textAlign: 'left',
        }}
      >
        <Story />
      </button>
    ),
  ],
  args: {
    title: 'New booking request',
    body: 'Maya Santos requested a coffee walk on Saturday at 2:30 PM.',
    timeLabel: '4 minutes ago',
    dateTime: '2026-08-23T11:56:00.000Z',
    density: 'comfortable',
    tone: 'social',
    unread: true,
  },
} satisfies Meta<typeof NotificationItemContent>

export default meta
type Story = StoryObj<typeof meta>

export const UnreadBooking: Story = {}

export const CompactMessage: Story = {
  args: {
    title: 'New message',
    body: 'Alex sent you a message.',
    timeLabel: 'Now',
    density: 'compact',
    tone: 'social',
  },
}

export const ReadAccountUpdate: Story = {
  args: {
    title: 'Identity verification approved',
    body: 'Your identity check is complete. Booking access is available.',
    timeLabel: 'Yesterday',
    tone: 'self',
    unread: false,
  },
}

export const SafetyAlert: Story = {
  args: {
    title: 'Companion application not approved',
    body: 'Open Companion tools to review the decision and your available next step.',
    timeLabel: 'Aug 21',
    tone: 'danger',
  },
}

export const LongCopy: Story = {
  args: {
    title: 'Completion confirmation needed for your Saturday conversation practice booking',
    body: 'Morgan confirmed that the experience is complete. Review the booking details and add your confirmation when you are ready.',
    timeLabel: 'Aug 20 at 6:42 PM',
    tone: 'neutral',
  },
}
