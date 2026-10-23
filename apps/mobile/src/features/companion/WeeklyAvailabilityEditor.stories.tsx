import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { WeeklyAvailabilityEditorPresentation } from './WeeklyAvailabilityEditor'

const meta = {
  title: 'Mobile/Companion/Weekly availability editor',
  component: WeeklyAvailabilityEditorPresentation,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    initialWindows: [{ weekday: 1, startMinutes: 540, endMinutes: 720 }],
    onSave: () => undefined,
  },
} satisfies Meta<typeof WeeklyAvailabilityEditorPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const EditExisting: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Manila times members can request')).toBeInTheDocument()
    await expect(canvas.getByText('9:00 AM')).toBeInTheDocument()
  },
}

export const EmptySchedule: Story = {
  args: { initialWindows: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No windows shared. Add times below, or save empty to block new requests.')).toBeInTheDocument()
  },
}

export const LegacyCanSaveClosedSchedule: Story = {
  args: { initialWindows: undefined, onSave: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const save = canvas.getByRole('button', { name: 'Save availability' })
    await expect(save).toBeEnabled()
    await userEvent.click(save)
    await expect(args.onSave).toHaveBeenCalledWith([])
  },
}

export const AddWindow: Story = {
  args: { initialWindows: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add time window' }))
    await expect(canvas.getByText('9:00 AM')).toBeInTheDocument()
  },
}

export const DarkSchedule: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Manila times members can request')).toBeInTheDocument()
  },
}
