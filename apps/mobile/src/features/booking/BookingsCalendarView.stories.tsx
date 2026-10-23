import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Text } from 'react-native'

import { BookingsCalendarView } from './BookingsCalendarView'

const emptyNow = new Date(2026, 7, 15, 12, 0, 0)
const bookedNow = new Date(2026, 7, 10, 12, 0, 0)

type StoryBooking = {
  _id: string
  requestedAt: number
  status: string
}

function renderBooking(booking: StoryBooking) {
  return <Text>{`Booking ${booking._id}`}</Text>
}

const meta = {
  title: 'Mobile/Booking/Bookings calendar',
  component: BookingsCalendarView,
  args: {
    bookings: [],
    now: emptyNow,
    renderBooking,
  },
} satisfies Meta<typeof BookingsCalendarView>

export default meta
type Story = StoryObj<typeof meta>

export const EmptyShowsCalendarOnToday: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('SCHEDULE')).toBeVisible()
    await expect(canvas.getByText('August 2026')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Today' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Previous month' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Next month' })).toBeVisible()
    await expect(canvas.getAllByText('No bookings yet').length).toBeGreaterThanOrEqual(1)
    await expect(canvas.getByText('Future bookings appear here.')).toBeVisible()
    await expect(canvas.queryByText('Choose a marked date')).not.toBeInTheDocument()
  },
}

export const EmptyNavigatesMonthsAndDates: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Next month' }))
    await expect(await canvas.findByText('September 2026')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Previous month' }))
    await expect(await canvas.findByText('August 2026')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Today' }))
    await expect(await canvas.findByText('August 2026')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /Saturday, August 22, 2026/ }))
    await expect(await canvas.findByText(/Saturday, August 22, 2026/)).toBeVisible()
    await expect(canvas.getByText('Future bookings appear here.')).toBeVisible()
  },
}

export const PopulatedKeepsMarkedDateGuidance: Story = {
  args: {
    now: bookedNow,
    bookings: [
      { _id: 'a1', requestedAt: new Date(2026, 7, 20, 12, 0, 0).getTime(), status: 'accepted' },
    ] as never,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Booking a1')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /Saturday, August 22, 2026/ }))
    await expect(await canvas.findByText('Choose a marked date')).toBeVisible()
    await expect(canvas.getByText('Pick a day with a booking count to see its details.')).toBeVisible()
    await expect(canvas.queryByText('Future bookings appear here.')).not.toBeInTheDocument()
  },
}

export const EmptyAt320: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('August 2026')).toBeVisible()
    await expect(canvas.getAllByText('No bookings yet').length).toBeGreaterThanOrEqual(1)
    await expect(canvas.getByText('Future bookings appear here.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Today' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Previous month' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Next month' })).toBeVisible()
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1)
  },
}

export const EmptyDark: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('No bookings yet').length).toBeGreaterThanOrEqual(1)
    await expect(canvas.getByText('Future bookings appear here.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Today' })).toBeVisible()
  },
}
