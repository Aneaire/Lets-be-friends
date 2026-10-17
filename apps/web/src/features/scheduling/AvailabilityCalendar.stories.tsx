import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { AvailabilityCalendar } from './AvailabilityCalendar'

const selectStart = fn()
const changeMonth = fn()

const NOW = Date.UTC(2026, 9, 15, 2, 0)
const SLOT_0900 = Date.UTC(2026, 9, 20, 1, 0)
const SLOT_1030 = Date.UTC(2026, 9, 20, 2, 30)
const SLOT_1400 = Date.UTC(2026, 9, 21, 6, 0)
const STALE_START = Date.UTC(2026, 8, 20, 1, 0)

const days = [
  { date: '2026-10-20', startsAt: [SLOT_0900, SLOT_1030] },
  { date: '2026-10-21', startsAt: [SLOT_1400] },
]

const meta = {
  title: 'Features/Scheduling/Availability calendar',
  component: AvailabilityCalendar,
  args: {
    month: { year: 2026, month: 9 },
    onMonthChange: changeMonth,
    days,
    durationMinutes: 60,
    selectedStart: null,
    onSelectStart: selectStart,
    now: NOW,
  },
} satisfies Meta<typeof AvailabilityCalendar>

export default meta
type Story = StoryObj<typeof meta>

export const AvailableMonth: Story = {}

export const PickStartTime: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('gridcell', { name: /Tuesday, October 20, 2026/ }))
    await userEvent.click(canvas.getByRole('button', { name: '9:00 AM, 1 hr session' }))
    await expect(selectStart).toHaveBeenCalledWith(SLOT_0900)
  },
}

export const MonthNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Next month' }))
    await expect(changeMonth).toHaveBeenCalledWith({ year: 2026, month: 10 })
  },
}

export const Loading: Story = {
  args: { loading: true, days: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Loading available times')
  },
}

export const ScheduleNotShared: Story = {
  args: { scheduleConfigured: false },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('This Companion has not shared a weekly schedule yet.'),
    ).toBeInTheDocument()
  },
}

export const NoOpenTimes: Story = {
  args: { days: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/No open times this month/)).toBeInTheDocument()
  },
}

export const StaleSelection: Story = {
  args: { selectedStart: STALE_START },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('no longer available')
  },
}

export const Disabled: Story = {
  args: { selectedStart: SLOT_0900, disabled: true },
}

export const NarrowViewport: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
}
