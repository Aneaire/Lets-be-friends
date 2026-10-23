import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { BookingEvidencePresentation } from './BookingEvidencePresentation'

const noop = () => undefined
const asyncNoop = async () => undefined

const meta = {
  title: 'Mobile/Organisms/Booking evidence',
  component: BookingEvidencePresentation,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    participantRole: 'member_end',
    onChooseImage: noop,
    onRequestSkip: noop,
    onCloseSkipConfirmation: noop,
    onConfirmSkip: asyncNoop,
  },
} satisfies Meta<typeof BookingEvidencePresentation>

export default meta
type Story = StoryObj<typeof meta>

export const SharedRecord: Story = {
  args: {
    rows: [
      { role: 'companion_start', isViewer: false, decision: 'uploaded' },
      { role: 'member_end', isViewer: true, decision: undefined },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('SHARED SAFETY RECORD')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Start: uploaded')).toBeInTheDocument()
    await expect(canvas.getByLabelText('End (you): not decided')).toBeInTheDocument()
  },
}

export const LoadingRecord: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loading the shared safety record.')).toBeInTheDocument()
  },
}

export const ClosedWindow: Story = {
  args: {
    canDecide: false,
    rows: [
      { role: 'companion_start', isViewer: false, decision: 'skipped' },
      { role: 'member_end', isViewer: true, decision: 'uploaded' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/The evidence window for this booking has closed/)).toBeInTheDocument()
  },
}

export const DarkSharedRecord: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    rows: [
      { role: 'companion_start', isViewer: false, decision: 'uploaded' },
      { role: 'member_end', isViewer: true, decision: undefined },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('SHARED SAFETY RECORD')).toBeInTheDocument()
  },
}
