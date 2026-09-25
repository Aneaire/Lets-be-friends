import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShieldCheck, UserRound } from 'lucide-react'
import { expect, within } from 'storybook/test'

import { VerificationStep } from './VerificationStep'

const meta = {
  title: 'Features/Verification/Verification step',
  component: VerificationStep,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: {
    step: 1,
    title: 'Identity check',
    icon: <ShieldCheck size={20} aria-hidden="true" />,
    completed: false,
    headingId: 'verify-identity-heading',
    children: <p className="text-body muted">Submit a government ID and a current selfie. Only the safety team reviews them.</p>,
  },
} satisfies Meta<typeof VerificationStep>

export default meta
type Story = StoryObj<typeof meta>

export const IdentityInProgress: Story = {
  args: {
    status: <span className="status-pill" data-tone="warning">Under review</span>,
    children: (
      <>
        <p className="text-body muted">Submit a government ID and a current selfie. Only the safety team reviews them.</p>
        <p className="verification-guidance">Your identity check is with the safety team. This usually takes one business day.</p>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Identity check' })).toBeVisible()
    await expect(canvas.getByText('Under review')).toBeVisible()
  },
}

export const IdentityApproved: Story = {
  args: {
    completed: true,
    status: <span className="status-pill" data-tone="success">Approved</span>,
    children: <p className="verification-complete-copy">Your identity and safety review are approved.</p>,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Your identity and safety review are approved.'),
    ).toBeVisible()
  },
}

export const CompanionLocked: Story = {
  args: {
    step: 2,
    title: 'Companion profile',
    icon: <UserRound size={20} aria-hidden="true" />,
    headingId: 'verify-companion-heading',
    status: <span className="status-pill" data-tone="self">Not started</span>,
    children: (
      <>
        <p className="text-body muted">Share your activities, session format, availability, and profile details.</p>
        <p className="verification-guidance verification-lock-note">
          Submit your identity check for safety review first. Your Companion profile unlocks after your identity is submitted for review.
        </p>
        <button type="button" className="btn btn-self mt-4" disabled title="Submit your identity check first">
          Create Companion profile
        </button>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Create Companion profile' })
    await expect(button).toBeDisabled()
  },
}

export const CompanionApproved: Story = {
  args: {
    step: 2,
    title: 'Companion profile',
    icon: <UserRound size={20} aria-hidden="true" />,
    headingId: 'verify-companion-heading',
    completed: true,
    status: <span className="status-pill" data-tone="success">Approved</span>,
    children: (
      <>
        <p className="verification-complete-copy">Your Companion profile is approved and visible to members.</p>
        <a href="/settings" className="btn btn-neutral mt-4">Manage in settings</a>
      </>
    ),
  },
}

export const NarrowDark: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
}
