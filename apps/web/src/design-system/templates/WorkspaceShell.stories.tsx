import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { WorkspaceShell } from './WorkspaceShell'

const createBooking = fn()

function Rail({ long = false }: { long?: boolean }) {
  return (
    <>
      <div className="rail-section">
        <div className="rail-section-title">Your bookings</div>
        <a href="#open" className="rail-link is-active" aria-current="location">
          <span>{long ? 'Open booking requests needing your attention' : 'Open'}</span>
          <span className="rail-link-count tabular">3</span>
        </a>
        <a href="#past" className="rail-link">
          <span>{long ? 'Past and closed booking experiences' : 'Past'}</span>
          <span className="rail-link-count tabular">12</span>
        </a>
      </div>
      <div className="rail-section">
        <div className="rail-section-title">Account</div>
        <a href="#profile" className="rail-link">
          <span>Companion profile</span>
        </a>
        <a href="#safety" className="rail-link">
          <span>How safety works</span>
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
    <div className="stack-md">
      <section className="panel">
        <p className="text-meta">SATURDAY · 2:30 PM</p>
        <h2 className="text-h2">Conversation practice with Alex</h2>
        <p className="text-soft">
          Online · 90 minutes · Identity checked
        </p>
      </section>
      <section className="panel">
        <p className="text-meta">MONDAY · 10:00 AM</p>
        <h2 className="text-h2">Neighborhood orientation with Sam</h2>
        <p className="text-soft">
          In person · Public meeting place · Request awaiting response
        </p>
      </section>
    </div>
  )
}

const meta = {
  title: 'Web/Templates/Workspace shell',
  component: WorkspaceShell,
  parameters: { layout: 'fullscreen' },
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
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Past 12' })).toHaveAttribute(
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
