import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Pressable, StyleSheet } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { BookingCard } from '@/design-system/organisms/BookingCard'
import { useAppTheme } from '@/theme/ThemeProvider'

import { BookingMessageShell, ConversationThreadHeader } from './ConversationThreadPresentation'

const goBack = fn()
const openSafety = fn()
const openBooking = fn()
const reportMessage = fn()

const booking = {
  id: 'booking_thread_story',
  participantName: 'Alexandria Marisol Rivera-Santos',
  category: 'Coffee, conversation, and neighborhood orientation',
  mode: 'in_person' as const,
  requestedAt: Date.UTC(2026, 8, 12, 6, 30),
  durationMinutes: 90,
  status: 'request_sent' as const,
  memberTotalCentavos: 120000,
}

function StoryReportAction() {
  const theme = useAppTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Report message"
      onPress={reportMessage}
      style={styles.reportAction}
    >
      <AppText variant="caption" color={theme.colors.danger}>Report message</AppText>
    </Pressable>
  )
}

const meta = {
  title: 'Mobile/Organisms/Conversation thread presentation',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const HeaderLongIdentityAt320: Story = {
  render: () => (
    <ConversationThreadHeader
      name="Alexandria Marisol Rivera-Santos"
      onBack={goBack}
      onSafety={openSafety}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Private member conversation')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Back to conversations' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Safety options for Alexandria Marisol Rivera-Santos' }))
    await expect(goBack).toHaveBeenCalledOnce()
    await expect(openSafety).toHaveBeenCalledOnce()
  },
}

export const HeaderPausedAt320: Story = {
  render: () => (
    <ConversationThreadHeader
      name="Alex Rivera"
      paused
      onBack={goBack}
      onSafety={openSafety}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Conversation paused')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Safety options for Alex Rivera' })).toBeVisible()
  },
}

export const AuthorizedBookingMessageAt320: Story = {
  render: () => (
    <BookingMessageShell
      body="A booking update was added to this private conversation."
      category={booking.category}
      booking={<BookingCard compact booking={booking} onPress={openBooking} />}
      reportAction={<StoryReportAction />}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Open Coffee, conversation, and neighborhood orientation booking/ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Report message' }))
    await expect(openBooking).toHaveBeenCalledOnce()
    await expect(reportMessage).toHaveBeenCalledOnce()
  },
}

export const UnverifiedBookingRoleAt320: Story = {
  render: () => (
    <BookingMessageShell
      body="A booking update remains in the conversation record."
      category="Coffee, conversation, and neighborhood orientation"
      reportAction={<StoryReportAction />}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Booking details are not linked because your role in this booking could not be verified.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /Open .* booking/ })).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Report message' })).toBeVisible()
  },
}

const styles = StyleSheet.create({
  reportAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
})
