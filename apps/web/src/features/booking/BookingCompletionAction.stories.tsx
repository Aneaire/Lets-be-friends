import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { BookingCompletionAction } from './BookingCompletionAction'

const keepPending = fn(() => new Promise<void>(() => undefined))
const rejectCompletion = fn(async () => {
  throw new Error('Booking cannot be completed before the scheduled session ends.')
})

const meta = {
  title: 'Features/Booking/Completion action',
  component: BookingCompletionAction,
  parameters: { layout: 'centered' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: { onComplete: fn(async () => undefined) },
} satisfies Meta<typeof BookingCompletionAction>

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {}

export const Confirming: Story = {
  args: { onComplete: keepPending },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm completion' }))
    const pending = canvas.getByRole('button', { name: 'Confirming completion…' })
    await expect(pending).toHaveAttribute('aria-busy', 'true')
    await expect(pending).toBeDisabled()
  },
}

export const Rejected: Story = {
  args: { onComplete: rejectCompletion },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm completion' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Booking cannot be completed before the scheduled session ends.',
    )
    await expect(
      canvas.getByRole('button', { name: 'Confirm completion' }),
    ).toBeEnabled()
  },
}
