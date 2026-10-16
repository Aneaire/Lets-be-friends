import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ActionNote } from './ActionNote'

const submitApproval = fn(async () => undefined)
const submitRequiredNote = fn(async () => undefined)
const keepWorking = fn(() => new Promise<unknown>(() => undefined))
const rejectAction = fn(async () => {
  throw new Error('The rejection could not be saved.')
})

const meta = {
  title: 'Admin/Molecules/Action note',
  component: ActionNote,
  parameters: { layout: 'padded' },
  args: {
    label: 'Approve',
    onSubmit: submitApproval,
  },
} satisfies Meta<typeof ActionNote>

export default meta
type Story = StoryObj<typeof meta>

export const OptionalNote: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Approve' }))
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Internal note' }),
      'Identity evidence matches the member profile.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Approve' }))
    await expect(submitApproval).toHaveBeenCalledWith(
      'Identity evidence matches the member profile.',
    )
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument()
  },
}

export const RequiredValidation: Story = {
  args: {
    label: 'Reject',
    submitLabel: 'Reject application',
    requireNote: true,
    tone: 'danger',
    onSubmit: submitRequiredNote,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Reject' }))
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reject application' }),
    )
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Internal note required.',
    )
    await expect(submitRequiredNote).not.toHaveBeenCalled()
  },
}

export const Submitting: Story = {
  args: {
    label: 'Resolve report',
    onSubmit: keepWorking,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Resolve report' }),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Resolve report' }),
    )
    await expect(canvas.getByRole('button', { name: 'Working...' })).toBeDisabled()
    await expect(canvas.getByRole('form')).toHaveAttribute('aria-busy', 'true')
  },
}

export const RejectedAction: Story = {
  args: {
    label: 'Suspend member',
    submitLabel: 'Confirm suspension',
    requireNote: true,
    tone: 'danger',
    placeholder: 'Suspension reason',
    onSubmit: rejectAction,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Suspend member' }),
    )
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Suspension reason required' }),
      'Repeated unsafe contact after a prior warning.',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Confirm suspension' }),
    )
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'The rejection could not be saved.',
    )
  },
}

export const Disabled: Story = {
  args: {
    label: 'Approve while loading',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', {
        name: 'Approve while loading',
      }),
    ).toBeDisabled()
  },
}

export const DangerNarrow: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    label: 'Reject booking verification request',
    submitLabel: 'Reject request',
    requireNote: true,
    tone: 'danger',
    placeholder: 'Reason visible to the operations team',
    onSubmit: submitRequiredNote,
  },
}

const submitWithChoice = fn(async () => undefined)

export const RequiredChoice: Story = {
  args: {
    label: 'Reject',
    submitLabel: 'Reject submission',
    tone: 'danger',
    requireNote: true,
    placeholder: 'Internal note',
    choice: {
      label: 'Reason the member will see',
      placeholder: 'Choose a reason',
      options: [
        { value: 'unclear_image', label: 'The ID image was unclear or unreadable' },
        { value: 'expired_id', label: 'The ID has expired' },
        { value: 'other', label: 'Another reason the member should start again' },
      ],
    },
    onSubmit: submitWithChoice,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Reject' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Internal note required' }), 'Expired licence on file.')

    // The member-facing reason is required alongside the internal note.
    await userEvent.click(canvas.getByRole('button', { name: 'Reject submission' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('Reason the member will see required.')
    await expect(submitWithChoice).not.toHaveBeenCalled()

    await userEvent.selectOptions(canvas.getByLabelText('Reason the member will see'), 'expired_id')
    await userEvent.click(canvas.getByRole('button', { name: 'Reject submission' }))
    await expect(submitWithChoice).toHaveBeenCalledWith('Expired licence on file.', 'expired_id')
    await expect(canvas.queryByRole('combobox')).not.toBeInTheDocument()
  },
}
