import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { BadgeDollarSign, ShieldCheck, UserRound, UserRoundCog } from 'lucide-react'

import { SettingsLinkRow, SettingsSection } from './SettingsPresentation'

const meta = {
  title: 'Features/Settings/Settings presentation',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const AccountAndCompanionSections: Story = {
  render: () => (
    <main className="settings-page">
      <header className="settings-page-header">
        <p className="text-meta">Your account</p>
        <h1 className="text-h1">Settings</h1>
        <p className="text-body muted">Choose how the app looks and manage your account.</p>
      </header>
      <div className="settings-stack">
        <SettingsSection
          headingId="story-account-heading"
          title="Account"
          description="Keep personal details separate from app preferences."
        >
          <SettingsLinkRow
            link={<a href="/profile" />}
            icon={<UserRound size={19} aria-hidden="true" className="settings-row-icon" />}
            title="Personal profile"
            description="Name, photo, bio, and sign-in email (maya@example.com)"
            actionLabel="Manage"
          />
        </SettingsSection>
        <SettingsSection
          headingId="story-companion-heading"
          title="Companion"
          description="Verified profiles are locked. Change your price and profile details here."
        >
          <SettingsLinkRow
            link={<a href="/become-companion?edit=true" />}
            icon={<BadgeDollarSign size={19} aria-hidden="true" className="settings-row-icon" />}
            title="Hourly rate"
            description="Currently ₱500.00 per hour. Rate changes go live right away."
            actionLabel="Change"
          />
          <SettingsLinkRow
            link={<a href="/become-companion?edit=true" />}
            icon={<UserRoundCog size={19} aria-hidden="true" className="settings-row-icon" />}
            title="Companion profile details"
            description="Activities, session format, intro, and location. Changes the review team checks go back to review."
            actionLabel="Edit"
          />
          <SettingsLinkRow
            link={<a href="/get-verified" />}
            icon={<ShieldCheck size={19} aria-hidden="true" className="settings-row-icon" />}
            title="Verification status"
            description="Review your identity and Companion approval."
            actionLabel="View"
          />
        </SettingsSection>
      </div>
    </main>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const account = canvas.getByRole('region', { name: 'Account' })
    await expect(account).toBeVisible()
    const personal = canvas.getByRole('link', { name: /Personal profile/ })
    await expect(personal).toHaveAttribute('href', '/profile')
    const rate = canvas.getByRole('link', { name: /Hourly rate/ })
    await expect(rate).toHaveAttribute('href', '/become-companion?edit=true')
    await expect(canvas.getByText('Verification status')).toBeVisible()
  },
}

export const NarrowMobile: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  render: () => (
    <main className="settings-page">
      <header className="settings-page-header">
        <p className="text-meta">Your account</p>
        <h1 className="text-h1">Settings</h1>
        <p className="text-body muted">Choose how the app looks and manage your account.</p>
      </header>
      <div className="settings-stack">
        <SettingsSection
          headingId="story-narrow-heading"
          title="Companion"
          description="Verified profiles are locked. Change your price and profile details here."
        >
          <SettingsLinkRow
            link={<a href="/become-companion?edit=true" />}
            icon={<UserRoundCog size={19} aria-hidden="true" className="settings-row-icon" />}
            title="Companion profile details"
            description="Activities, session format, intro, and location. Changes the review team checks go back to review."
            actionLabel="Edit"
          />
        </SettingsSection>
      </div>
    </main>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
    await expect(within(canvasElement).getByRole('region', { name: 'Companion' })).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark', viewport: { value: 'desktop', isRotated: false } },
  render: AccountAndCompanionSections.render,
}
