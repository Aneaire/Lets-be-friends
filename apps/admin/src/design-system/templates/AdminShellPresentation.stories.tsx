import { ArrowRight, ClipboardCheck, Flag, ShieldCheck } from 'lucide-react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { AdminShellPresentation } from './AdminShellPresentation'

const counts = {
  companionApplicationsPending: 8,
  memberVerificationsPending: 3,
  reportsOpen: 5,
}

function OverviewContent() {
  return (
    <>
      <header className="admin-page-header admin-overview-header">
        <div>
          <p className="eyebrow">Trust operations</p>
          <h1 className="text-h1 mt-2">Your work starts here.</h1>
          <p className="lede mt-2">Review open queues, then check the latest admin activity.</p>
        </div>
      </header>
      <section className="admin-queue-section" aria-labelledby="story-open-work">
        <div className="admin-section-heading">
          <div><p className="eyebrow">Priority queues</p><h2 className="text-h2" id="story-open-work">Open work</h2></div>
          <p className="text-meta">Select a queue to start reviewing.</p>
        </div>
        <div className="admin-stat-grid">
          <StoryQueueCard icon={<ClipboardCheck size={18} />} label="Companion profiles" value={8} />
          <StoryQueueCard icon={<ShieldCheck size={18} />} label="Identity checks" value={3} />
          <StoryQueueCard icon={<Flag size={18} />} label="Safety reports" value={5} />
        </div>
      </section>
    </>
  )
}

function StoryQueueCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <a className="admin-stat admin-queue-card" href="#queue">
      <span className="admin-stat-icon" aria-hidden="true">{icon}</span>
      <span className="admin-stat-copy"><strong className="admin-stat-value tabular">{value}</strong><span className="admin-stat-label">{label}</span></span>
      <ArrowRight className="admin-stat-arrow" size={16} aria-hidden="true" />
    </a>
  )
}

const meta = {
  title: 'Admin/Templates/Shell',
  component: AdminShellPresentation,
  parameters: { layout: 'fullscreen' },
  args: {
    viewerRole: 'admin',
    displayName: 'Morgan Lee',
    pathname: '/overview',
    counts,
    userAppHref: '/app',
    logoSrc: '/admin-assets/logo.svg',
    onSignOut: fn(),
    children: <OverviewContent />,
  },
} satisfies Meta<typeof AdminShellPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const Admin: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByText('8', { selector: '.rail-link-count' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Sign out' }))
    await expect(args.onSignOut).toHaveBeenCalledOnce()
  },
}

export const Reviewer: Story = {
  args: {
    viewerRole: 'reviewer',
    displayName: 'Sam Rivera',
    pathname: '/reports',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: /^Reports/ })).toHaveAttribute('aria-current', 'page')
    await expect(canvas.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('link', { name: 'Audit logs' })).not.toBeInTheDocument()
  },
}

export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobileDefault' } },
  args: {
    viewerRole: 'reviewer',
    displayName: 'Alex Kim',
    pathname: '/companion-applications',
  },
}
