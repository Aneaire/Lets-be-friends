import type { Meta, StoryObj } from '@storybook/react-vite'
import { CalendarDays, ChevronRight, History, ShieldCheck, UserRound } from 'lucide-react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { WorkspaceShell } from './WorkspaceShell'

const createBooking = fn()

function Rail({ long = false }: { long?: boolean }) {
  return (
    <>
      <div className="rail-section">
        <div className="rail-section-title">Your bookings</div>
        <a href="#open" className="rail-link is-active" aria-current="location">
          <span className="rail-link-label">
            <CalendarDays size={16} aria-hidden="true" />
            <span>{long ? 'Open booking requests needing your attention' : 'Open requests'}</span>
          </span>
          <span className="rail-link-count tabular">3</span>
        </a>
        <a href="#past" className="rail-link">
          <span className="rail-link-label">
            <History size={16} aria-hidden="true" />
            <span>{long ? 'Past and closed booking experiences' : 'Past bookings'}</span>
          </span>
          <span className="rail-link-count tabular">12</span>
        </a>
      </div>
      <div className="rail-section">
        <div className="rail-section-title">Account</div>
        <a href="#profile" className="rail-link">
          <span className="rail-link-label"><UserRound size={16} aria-hidden="true" /><span>Companion profile</span></span>
        </a>
        <a href="#safety" className="rail-link">
          <span className="rail-link-label"><ShieldCheck size={16} aria-hidden="true" /><span>How safety works</span></span>
        </a>
      </div>
    </>
  )
}

function MobileNavigation() {
  return (
    <>
      <a
        href="#open"
        className="workspace-mobile-nav-link is-active">
        <span>Open</span>
        <span className="tabular">3</span>
      </a>
      <a
        href="#past"
        className="workspace-mobile-nav-link">
        <span>Past</span>
        <span className="tabular">12</span>
      </a>
    </>
  )
}

function BookingContent() {
  return (
    <div className="workspace-story-list">
      <section className="workspace-story-card">
        <div className="workspace-story-date" aria-hidden="true"><span>12</span><small>Sep</small></div>
        <div className="workspace-story-card-copy">
          <p className="text-meta">Saturday at 2:30 PM</p>
          <h2 className="text-h2">Conversation practice with Alex</h2>
          <p className="text-soft">Online session, 90 minutes</p>
        </div>
        <span className="status-pill" data-tone="success">Confirmed</span>
        <ChevronRight className="workspace-story-arrow" size={18} aria-hidden="true" />
      </section>
      <section className="workspace-story-card">
        <div className="workspace-story-date" aria-hidden="true"><span>14</span><small>Sep</small></div>
        <div className="workspace-story-card-copy">
          <p className="text-meta">Monday at 10:00 AM</p>
          <h2 className="text-h2">Neighborhood orientation with Sam</h2>
          <p className="text-soft">In-person session, public meeting place</p>
        </div>
        <span className="status-pill" data-tone="social">Awaiting reply</span>
        <ChevronRight className="workspace-story-arrow" size={18} aria-hidden="true" />
      </section>
    </div>
  )
}

const meta = {
  title: 'Web/Templates/Workspace shell',
  component: WorkspaceShell,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="workspace-story-frame">
        <Story />
      </div>
    ),
  ],
  args: {
    title: 'Your bookings',
    variant: 'bookings',
    railLabel: 'Booking sections',
    rail: <Rail />,
    mobileNavigation: <MobileNavigation />,
    children: <BookingContent />,
  },
} satisfies Meta<typeof WorkspaceShell>

export default meta
type Story = StoryObj<typeof meta>

export const BookingsWithStatus: Story = {
  args: {
    status: (
      <button type="button" className="workspace-status-item workspace-status-action">
        <span>Identity</span>
        <span className="status-pill" data-tone="verified">Verified</span>
      </button>
    ),
    actions: (
      <button type="button" className="btn btn-social" onClick={createBooking}>
        Create booking
      </button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Create booking' }),
    )
    await expect(createBooking).toHaveBeenCalledOnce()
    await expect(
      canvas.getByRole('complementary', { name: 'Booking sections' }),
    ).toBeVisible()
  },
}

export const ActionsAndToolbar: Story = {
  args: {
    title: 'Your Companion space',
    variant: 'companion',
    status: (
      <span className="workspace-status-item">
        <span>Companion profile</span>
        <span className="status-pill" data-tone="self">Approved</span>
      </span>
    ),
    actions: (
      <button type="button" className="btn btn-neutral">
        Update availability
      </button>
    ),
    toolbar: (
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-neutral btn-sm">
          Active requests
        </button>
        <button type="button" className="btn btn-ghost btn-sm">
          History
        </button>
      </div>
    ),
  },
}

export const MobileNavigation320: Story = {
  globals: { viewport: 'mobileSmall' },
  play: async ({ canvasElement }) => {
    const pastLink = canvasElement.querySelector<HTMLAnchorElement>(
      '.workspace-mobile-nav-link[href="#past"]',
    )
    await expect(pastLink).toHaveAttribute(
      'href',
      '#past',
    )
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const LongTitleAndRail: Story = {
  globals: { viewport: 'mobileDefault' },
  args: {
    title: 'Bookings, identity checks, and account follow-up',
    rail: <Rail long />,
  },
}

export const Dark: Story = {
  globals: { theme: 'dark', viewport: 'mobileDefault' },
  args: {
    status: (
      <span className="workspace-status-item">
        <span>Identity</span>
        <span className="status-pill" data-tone="awaiting">In review</span>
      </span>
    ),
  },
}
