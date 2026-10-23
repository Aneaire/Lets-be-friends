import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'

import { BookingSlotPickerPresentation } from './BookingSlotPicker'

const tuesdayTen = Date.UTC(2026, 9, 27, 2, 0, 0)
const tuesdayEleven = Date.UTC(2026, 9, 27, 3, 0, 0)

const meta = {
  title: 'Mobile/Booking/Available slot picker',
  component: BookingSlotPickerPresentation,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    monthLabel: 'October 2026',
    onPrevMonth: () => undefined,
    onNextMonth: () => undefined,
    days: [
      { date: '2026-10-27', startsAt: [tuesdayTen, tuesdayEleven] },
      { date: '2026-10-28', startsAt: [tuesdayTen + 86_400_000] },
    ],
    selectedStart: null,
    onSelectStart: () => undefined,
  },
} satisfies Meta<typeof BookingSlotPickerPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const OpenTimes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('AVAILABLE TIMES')).toBeInTheDocument()
    await expect(canvas.getByText(/openings/)).toBeInTheDocument()
    const month = canvas.getByText('October 2026').getBoundingClientRect()
    await expect(month.width).toBeGreaterThan(100)
    await expect(month.height).toBeLessThan(50)
  },
}

export const SelectStart: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const days = canvas.getAllByRole('radio')
    await userEvent.click(days[0])
    const times = await canvas.findAllByRole('radio')
    expect(times.length).toBeGreaterThan(1)
  },
}

export const ExistingSelectionOpensItsDay: Story = {
  args: { selectedStart: tuesdayEleven },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('radio', { name: /11:00 AM Manila time, selected/ })).toBeVisible()
  },
}

export const NoOpenTimes: Story = {
  args: { days: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No open times this month')).toBeInTheDocument()
  },
}

export const UnconfiguredSchedule: Story = {
  args: { scheduleConfigured: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No availability calendar')).toBeInTheDocument()
  },
}

export const DarkPicker: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('AVAILABLE TIMES')).toBeInTheDocument()
  },
}
