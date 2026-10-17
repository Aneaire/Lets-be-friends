import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { WeeklyAvailabilityEditor } from './WeeklyAvailabilityEditor'

const saveAvailability = fn(async () => undefined)
const saveRejected = fn(async () => {
  throw new Error('Availability could not be saved. Try again.')
})

const meta = {
  title: 'Features/Scheduling/Weekly availability editor',
  component: WeeklyAvailabilityEditor,
  args: {
    initialAvailability: [
      { weekday: 1, startMinutes: 9 * 60, endMinutes: 12 * 60 },
      { weekday: 2, startMinutes: 13 * 60, endMinutes: 17 * 60 },
      { weekday: 6, startMinutes: 10 * 60, endMinutes: 15 * 60 },
    ],
    onSave: saveAvailability,
  },
} satisfies Meta<typeof WeeklyAvailabilityEditor>

export default meta
type Story = StoryObj<typeof meta>

export const ConfiguredWeek: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Monday window 1 start time')).toHaveValue('09:00')
    await expect(canvas.getByLabelText('Saturday window 1 end time')).toHaveValue('15:00')
    await expect(canvas.getAllByRole('switch')).toHaveLength(7)
  },
}

export const AddDayAndSave: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch', { name: 'Wednesday availability' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save availability' }))
    await expect(saveAvailability).toHaveBeenCalledWith([
      { weekday: 1, startMinutes: 9 * 60, endMinutes: 12 * 60 },
      { weekday: 2, startMinutes: 13 * 60, endMinutes: 17 * 60 },
      { weekday: 3, startMinutes: 9 * 60, endMinutes: 17 * 60 },
      { weekday: 6, startMinutes: 10 * 60, endMinutes: 15 * 60 },
    ])
    await expect(canvas.getByRole('status')).toHaveTextContent('Availability saved.')
  },
}

export const MultipleWindows: Story = {
  args: {
    initialAvailability: [
      { weekday: 1, startMinutes: 9 * 60, endMinutes: 12 * 60 },
      { weekday: 1, startMinutes: 13 * 60, endMinutes: 17 * 60 },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByLabelText(/Monday window \d start time/)).toHaveLength(2)
    await userEvent.click(canvas.getByRole('button', { name: 'Add another window for Monday' }))
    await expect(canvas.getAllByLabelText(/Monday window \d start time/)).toHaveLength(3)
  },
}

export const AllDaysUnavailable: Story = {
  args: { initialAvailability: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/All days are currently unavailable/)).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Save availability' }))
    await expect(saveAvailability).toHaveBeenCalledWith([])
  },
}

export const OverlapRejected: Story = {
  args: {
    initialAvailability: [
      { weekday: 1, startMinutes: 9 * 60, endMinutes: 11 * 60 },
      { weekday: 1, startMinutes: 10 * 60, endMinutes: 12 * 60 },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Save availability' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('overlap')
  },
}

export const MidnightEnd: Story = {
  args: {
    initialAvailability: [{ weekday: 5, startMinutes: 20 * 60, endMinutes: 24 * 60 }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Friday window 1 ends at midnight')).toBeChecked()
    await expect(canvas.getByLabelText('Friday window 1 end time')).toBeDisabled()
  },
}

export const SaveError: Story = {
  args: { onSave: saveRejected },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Save availability' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('Availability could not be saved.')
  },
}

export const NarrowViewport: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    initialAvailability: [
      { weekday: 1, startMinutes: 9 * 60, endMinutes: 12 * 60 },
      { weekday: 1, startMinutes: 13 * 60, endMinutes: 17 * 60 },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
}
