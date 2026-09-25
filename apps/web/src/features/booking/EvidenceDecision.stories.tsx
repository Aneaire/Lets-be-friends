import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { EvidenceDecisionView } from './EvidenceDecision'

const guidance = 'You make the start decision. The image is optional and private; a reviewer or admin can retrieve it only with an active linked booking report, and each retrieval is audited. The member cannot access it.'

const skip = fn()
const upload = fn()

const meta = {
  title: 'Features/Booking/Evidence decision',
  component: EvidenceDecisionView,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    label: 'Start evidence',
    guidance,
    state: 'undecided',
    onUpload: upload,
    onSkip: skip,
  },
} satisfies Meta<typeof EvidenceDecisionView>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  args: { state: 'loading' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('status'),
    ).toHaveTextContent('Loading evidence status')
  },
}

export const Undecided: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Upload private image')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Skip after warning' })).toBeVisible()
  },
}

export const Uploading: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Processing image…')).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'Skip after warning' }),
    ).toBeDisabled()
  },
}

export const UploadFailed: Story = {
  args: { error: 'Evidence image could not be saved.' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Evidence image could not be saved.'),
    ).toBeVisible()
  },
}

export const ImageSaved: Story = {
  args: { state: 'decided', decision: 'uploaded' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Private image saved/),
    ).toBeVisible()
  },
}

export const SkippedAfterWarning: Story = {
  args: { state: 'decided', decision: 'skipped' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Skipped after warning acknowledgement/),
    ).toBeVisible()
  },
}

export const NarrowDarkUndecided: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Skip after warning' }),
    )
    await expect(skip).toHaveBeenCalled()
  },
}
