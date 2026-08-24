import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { userEvent, within } from 'storybook/test'
import { Calendar } from './Calendar'

const meta = {
  title: 'Web/Organisms/Calendar',
  component: Calendar,
  args: {
    value: new Date(2026, 7, 15),
    onChange: () => undefined,
  },
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta<typeof Calendar>
export default meta
type Story = StoryObj<typeof meta>

function CalendarExample({ constrained = false }: { constrained?: boolean }) {
  const [value, setValue] = useState(new Date(2026, 7, 15, 14, 30))
  return (
    <div className="ds-story-stack">
      <Calendar
        value={value}
        onChange={setValue}
        variant="social"
        min={constrained ? new Date(2026, 7, 12) : undefined}
        max={constrained ? new Date(2026, 8, 8) : undefined}
        aria-label="Booking date"
      />
      <p className="soft">Selected: {value.toLocaleDateString()}</p>
    </div>
  )
}

export const BookingDate: Story = {
  render: () => <CalendarExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Booking date' }))
  },
}

export const ConstrainedRange: Story = {
  render: () => <CalendarExample constrained />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Booking date' }))
  },
}

export const Disabled: Story = {
  args: {
    value: new Date(2026, 7, 15),
    onChange: () => undefined,
    disabled: true,
    'aria-label': 'Booking date unavailable',
  },
}
