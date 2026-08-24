import type { Meta, StoryObj } from '@storybook/react-vite'
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
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="text-h1">Review overview</h1>
          <p className="lede">Prioritize identity, safety, and moderation work.</p>
        </div>
        <button type="button" className="btn btn-neutral">Refresh records</button>
      </header>
      <section className="admin-stat-grid" aria-label="Open work">
        <article className="admin-stat"><span className="admin-stat-label">Companion profiles</span><strong className="admin-stat-value tabular">8</strong></article>
        <article className="admin-stat"><span className="admin-stat-label">Identity checks</span><strong className="admin-stat-value tabular">3</strong></article>
        <article className="admin-stat"><span className="admin-stat-label">Safety reports</span><strong className="admin-stat-value tabular">5</strong></article>
      </section>
    </>
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
