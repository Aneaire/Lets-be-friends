import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Pressable, StyleSheet } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { BookingCard } from '@/design-system/organisms/BookingCard'
import { useAppTheme } from '@/theme/ThemeProvider'

import { BookingMessageShell, ConversationThreadHeader } from './ConversationThreadPresentation'

const goBack = fn()
const openSafety = fn()
const openMenu = fn()
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
      <AppText variant="caption" color={theme.colors.danger}>…</AppText>
    </Pressable>
  )
}

const meta = {
  title: 'Mobile/Organisms/Conversation thread presentation',
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
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
    await expect(canvas.getByText('Alexandria Marisol Rivera-Santos')).toBeVisible()
    await expect(canvas.queryByText('Private member conversation')).not.toBeInTheDocument()
    await expect(canvas.queryByText('Conversation paused')).not.toBeInTheDocument()
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
    await expect(canvas.queryByText('A booking update was added to this private conversation.')).not.toBeInTheDocument()
    const card = canvas.getByRole('button', { name: /Open Coffee, conversation, and neighborhood orientation booking/ })
    const report = canvas.getByRole('button', { name: 'Report message' })
    expect(card.clientWidth).toBeGreaterThanOrEqual(260)
    expect(report.getBoundingClientRect().top).toBeGreaterThanOrEqual(card.getBoundingClientRect().bottom - 1)
    await userEvent.click(card)
    await userEvent.click(report)
    await expect(openBooking).toHaveBeenCalledOnce()
    await expect(reportMessage).toHaveBeenCalledOnce()
  },
}

export const CancelledBookingKeepsReasonAt320: Story = {
  render: () => (
    <BookingMessageShell
      body="The Companion (Alexandria Marisol Rivera-Santos) cancelled this Coffee request. Reason: Unexpected schedule change."
      showBody
      category={booking.category}
      booking={<BookingCard compact booking={{ ...booking, status: 'cancelled' }} onPress={openBooking} />}
      reportAction={<StoryReportAction />}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Reason: Unexpected schedule change/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Report message' })).toBeVisible()
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
    await expect(canvas.getByText('A booking update remains in the conversation record.')).toBeVisible()
    await expect(canvas.getByText('Booking details are not linked because your role in this booking could not be verified.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /Open .* booking/ })).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Report message' })).toBeVisible()
  },
}

const styles = StyleSheet.create({
  reportAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
})

export const HeaderWithMenuAt320: Story = {
  render: () => (
    <ConversationThreadHeader
      name="Alexandria Marisol Rivera-Santos"
      onBack={goBack}
      onOpenMenu={openMenu}
      onSafety={openSafety}
    />
  ),
  play: async ({ canvasElement }) => {
    openMenu.mockClear()
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Alexandria Marisol Rivera-Santos')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /Safety options/ })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Conversation menu for Alexandria Marisol Rivera-Santos' }))
    await expect(openMenu).toHaveBeenCalledOnce()
  },
}
