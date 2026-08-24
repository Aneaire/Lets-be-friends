import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { BookingRequestFields } from './BookingRequestFields'

const changeCategory = fn()
const changeMode = fn()
const changeDuration = fn()
const changeDay = fn()
const changeTime = fn()
const changeNotes = fn()

const meta = {
  title: 'Features/Booking/Request fields',
  component: BookingRequestFields,
  args: {
    category: 'Coffee and conversation',
    categoryOptions: [
      'Coffee and conversation',
      'Walking and outdoors',
      'Museum visit',
    ],
    onCategoryChange: changeCategory,
    mode: 'online',
    modeOptions: ['online', 'in_person'],
    onModeChange: changeMode,
    durationMinutes: 60,
    onDurationMinutesChange: changeDuration,
    requestedAt: new Date(2030, 0, 15, 14, 30),
    requestedTime: '14:30',
    onRequestedDayChange: changeDay,
    onRequestedTimeChange: changeTime,
    notes: 'I would enjoy a relaxed conversation about local food and travel.',
    onNotesChange: changeNotes,
    estimate: {
      memberTotalCentavos: 52_500,
      serviceSubtotalCentavos: 50_000,
      memberBookingFeeCentavos: 2_500,
    },
    disabled: false,
  },
} satisfies Meta<typeof BookingRequestFields>

export default meta
type Story = StoryObj<typeof meta>

export const EstimatedTotal: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Estimated booking total:/)).toHaveTextContent(
      '₱525.00',
    )
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const FieldChanges: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.selectOptions(
      canvas.getByLabelText('What would you like to do?'),
      'Walking and outdoors',
    )
    await userEvent.selectOptions(canvas.getByLabelText('Mode'), 'in_person')
    await userEvent.selectOptions(canvas.getByLabelText(/Duration/), '120')
    await userEvent.clear(canvas.getByLabelText('Time'))
    await userEvent.type(canvas.getByLabelText('Time'), '16:45')
    await userEvent.clear(
      canvas.getByLabelText(/Anything you would like them to know/),
    )
    await userEvent.type(
      canvas.getByLabelText(/Anything you would like them to know/),
      'A shaded outdoor route would be comfortable.',
    )

    await expect(changeCategory).toHaveBeenCalledWith('Walking and outdoors')
    await expect(changeMode).toHaveBeenCalledWith('in_person')
    await expect(changeDuration).toHaveBeenCalledWith(120)
    await expect(changeTime).toHaveBeenCalled()
    await expect(changeNotes).toHaveBeenCalled()
  },
}

export const CalendarEscapeRestoresFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Booking date' })
    await userEvent.click(trigger)
    await expect(
      canvas.getByRole('dialog', { name: 'Pick a date' }),
    ).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await expect(
      canvas.queryByRole('dialog', { name: 'Pick a date' }),
    ).not.toBeInTheDocument()
    await expect(trigger).toHaveFocus()
  },
}

export const NoEstimateYet: Story = {
  args: { estimate: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByText(/Estimated booking total:/),
    ).not.toBeInTheDocument()
  },
}

export const OnlineOnly: Story = {
  args: { modeOptions: ['online'] },
  play: async ({ canvasElement }) => {
    const options = within(canvasElement).getByLabelText('Mode').querySelectorAll('option')
    await expect(options).toHaveLength(1)
    await expect(options[0]).toHaveTextContent('Online')
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByLabelText('What would you like to do?'),
    ).toBeDisabled()
    await expect(canvas.getByLabelText('Mode')).toBeDisabled()
    await expect(canvas.getByLabelText('Time')).toBeDisabled()
    await expect(
      canvas.getByLabelText(/Anything you would like them to know/),
    ).toBeDisabled()
  },
}

export const LongNotesAt320: Story = {
  globals: { viewport: 'mobileSmall' },
  args: {
    category: 'A long community activity title that still needs to remain readable',
    categoryOptions: [
      'A long community activity title that still needs to remain readable',
    ],
    notes: 'I use a mobility aid and would like a quiet, step-free meeting place close to public transport. Please let me know before accepting if the proposed place will not work.',
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
}
