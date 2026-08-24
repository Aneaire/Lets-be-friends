import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { BookingActionsMenu } from './BookingActionsMenu'

const cancelBooking = fn()
const editRequest = fn()
const reportBooking = fn()

const meta = {
  title: 'Features/Booking/Actions menu',
  component: BookingActionsMenu,
  parameters: { layout: 'centered' },
  args: {
    onCancel: cancelBooking,
    onEditRequest: editRequest,
    onReport: reportBooking,
  },
} satisfies Meta<typeof BookingActionsMenu>

export default meta
type Story = StoryObj<typeof meta>

export const FullMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', {
      name: 'More booking actions',
    })
    await userEvent.click(trigger)
    const actions = canvas.getByRole('group', { name: 'Booking actions' })
    await expect(
      within(actions).getByRole('button', { name: 'Edit request' }),
    ).toBeVisible()
    await userEvent.click(
      within(actions).getByRole('button', { name: 'Cancel booking' }),
    )
    await expect(cancelBooking).toHaveBeenCalledOnce()
    await expect(canvas.queryByRole('group')).not.toBeInTheDocument()
    await expect(trigger).toHaveFocus()
  },
}

export const ReportOnly: Story = {
  args: {
    onCancel: undefined,
    onEditRequest: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'More booking actions' }),
    )
    await expect(
      canvas.queryByRole('button', { name: 'Cancel booking' }),
    ).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Report' }))
    await expect(reportBooking).toHaveBeenCalledOnce()
  },
}

export const EscapeRestoresFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', {
      name: 'More booking actions',
    })
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    await expect(canvas.queryByRole('group')).not.toBeInTheDocument()
    await expect(trigger).toHaveFocus()
  },
}
