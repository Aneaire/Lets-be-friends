import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { CompanionAvailabilitySection } from './CompanionAvailabilitySection'

const meta = {
  title: 'Mobile/Companion/Weekly availability',
  component: CompanionAvailabilitySection,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof CompanionAvailabilitySection>

export default meta
type Story = StoryObj<typeof meta>

export const SharedSchedule: Story = {
  args: {
    availability: [
      { weekday: 1, startMinutes: 540, endMinutes: 720 },
      { weekday: 3, startMinutes: 780, endMinutes: 1020 },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Manila time')).toBeInTheDocument()
    await expect(canvas.getByText(/Mon 9:00 AM/)).toBeInTheDocument()
  },
}

export const NoSchedule: Story = {
  args: { availability: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No weekly availability shared yet.')).toBeInTheDocument()
  },
}

export const DarkSchedule: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    availability: [{ weekday: 1, startMinutes: 540, endMinutes: 720 }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Manila time')).toBeInTheDocument()
  },
}
