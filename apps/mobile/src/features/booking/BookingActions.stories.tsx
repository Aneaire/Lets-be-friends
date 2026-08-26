import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'
import { View } from 'react-native'

import { BookingCancelAction } from './BookingCancelAction'
import { BookingCompletionAction } from './BookingCompletionAction'
import { BookingMessagesButton } from './BookingMessagesButton'

const meta = {
  title: 'Mobile/Booking/Booking actions',
  parameters: {
    viewport: { defaultViewport: 'mobileSmall' },
    a11y: { config: { rules: [{ id: 'aria-allowed-attr', enabled: false }] } },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const MemberActions: Story = {
  render: () => (
    <View style={{ gap: 12 }}>
      <BookingMessagesButton otherUserId="user_2" />
      <BookingCompletionAction
        bookingId={'booking_1' as never}
        status="accepted"
        pricingModel="hourly"
        requestedAt={Date.UTC(2026, 7, 20, 8)}
        durationMinutes={60}
        viewerRole="member"
        evidenceReady
      />
      <BookingCancelAction bookingId={'booking_1' as never} participantLabel="member" />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Confirm completed' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel booking' }))
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Cancel this booking?' })
    await expect(dialog).toBeInTheDocument()
  },
}

export const ConversationUnavailable: Story = {
  render: () => <BookingMessagesButton otherUserId="user_2" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open Messages' }))
    await expect(canvas.getByText(/exact conversation.*not available yet/i)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Open Messages inbox' })).toBeVisible()
  },
}
