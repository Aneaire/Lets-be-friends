import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { BookingRequestEditor } from './BookingRequestEditor'

const booking = {
  bookingId: 'booking_story' as never,
  companionProfileId: 'companion_profile_story' as never,
  companionDisplayName: 'Alex Rivera',
  category: 'Coffee and conversation',
  mode: 'online' as const,
  requestedAt: new Date(2030, 0, 15, 14, 30).getTime(),
  durationMinutes: 60,
  notes: 'A quiet table would be ideal.',
}

const companion = {
  categories: ['Coffee and conversation', 'Walking and outdoors'],
  mode: 'both' as const,
  hourlyRateCentavos: 50_000,
}

const meta = {
  title: 'Features/Booking/Request editor',
  component: BookingRequestEditor,
  parameters: { layout: 'fullscreen' },
  args: {
    booking,
    companion,
    onClose: () => undefined,
    onSave: async () => undefined,
  },
} satisfies Meta<typeof BookingRequestEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NarrowMobile: Story = {
  globals: { viewport: 'mobileSmall' },
}

export const RejectedSave: Story = {
  args: {
    onSave: async () => {
      throw new Error('The booking changed on another device.')
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent('The booking changed on another device.')
  },
}
