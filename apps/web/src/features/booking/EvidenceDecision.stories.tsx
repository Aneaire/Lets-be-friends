import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { EvidenceDecisionView, type EvidenceRow } from './EvidenceDecision'

const companionUndecided: EvidenceRow[] = [
  { role: 'companion_start', isViewer: true },
  { role: 'member_end', isViewer: false, decision: 'uploaded' },
]

const memberUndecided: EvidenceRow[] = [
  { role: 'companion_start', isViewer: false, decision: 'skipped' },
  { role: 'member_end', isViewer: true },
]

const upload = fn()
const skip = fn()

const meta = {
  title: 'Features/Booking/Evidence decision',
  component: EvidenceDecisionView,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    state: 'undecided',
    rows: companionUndecided,
    onUpload: upload,
    onSkip: skip,
  },
} satisfies Meta<typeof EvidenceDecisionView>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  args: { state: 'loading', rows: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('status'),
    ).toHaveTextContent('Loading evidence status')
  },
}

export const CompanionUndecided: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Start evidence')).toBeVisible()
    await expect(canvas.getByText('End evidence')).toBeVisible()
    await expect(canvas.getByText('The member')).toBeVisible()
    await expect(canvas.getByText('Private image saved')).toBeVisible()
    await expect(canvas.getByText('Upload private image')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Skip after warning' })).toBeVisible()
  },
}

export const MemberUndecided: Story = {
  args: { rows: memberUndecided },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('The Companion')).toBeVisible()
    await expect(canvas.getByText('Skipped after warning')).toBeVisible()
    await expect(canvas.getByText('You')).toBeVisible()
    await expect(canvas.getByText('Upload private image')).toBeVisible()
  },
}

export const CompanionSaved: Story = {
  args: {
    state: 'decided',
    rows: [
      { role: 'companion_start', isViewer: true, decision: 'uploaded' },
      { role: 'member_end', isViewer: false },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Private image saved')).toBeVisible()
    await expect(canvas.getByText('Not decided yet')).toBeVisible()
    await expect(canvas.queryByText('Upload private image')).toBeNull()
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

export const NarrowDarkMemberSaved: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    state: 'decided',
    rows: [
      { role: 'companion_start', isViewer: false, decision: 'uploaded' },
      { role: 'member_end', isViewer: true, decision: 'skipped' },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Skipped after warning'),
    ).toBeVisible()
    await expect(
      within(canvasElement).queryByText('Upload private image'),
    ).toBeNull()
  },
}

export const SkipRequested: Story = {
  args: { rows: companionUndecided },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Skip after warning' }),
    )
    await expect(skip).toHaveBeenCalled()
  },
}
