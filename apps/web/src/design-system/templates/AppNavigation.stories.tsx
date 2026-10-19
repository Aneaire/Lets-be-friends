import type { Meta, StoryObj } from '@storybook/react-vite'
import { BadgeCheck, Bell, CalendarCheck, Compass, House, MessageCircle, User, UserRound } from 'lucide-react'
import { expect, within } from 'storybook/test'

import { BrandLogo } from '../atoms/BrandLogo'

// The signed-in shell chrome in AppNavigation is a connected container: it reads
// Convex queries and Router state that Storybook does not provide. This story
// keeps the production markup and class names instead, so the responsive shell
// contract can still be verified in a real browser. That matters here because
// the header copy of Messages and Bookings is hidden by a media query whose
// outcome depends on the cascade layer, not on the markup.
function ShellChrome({ verified = false }: { verified?: boolean }) {
  return (
    <div className="app-frame web-app-shell">
      <header className="app-header" data-member="true">
        <div className="app-header-inner">
          <a className="brand-link" href="#home" aria-label="Let's Be Friends home">
            <BrandLogo className="h-8 w-7" />
            <span>Let&apos;s Be Friends</span>
          </a>
          <div className="app-header-context">
            <strong>Home</strong>
          </div>
          <div className="app-header-actions">
            <nav className="header-primary-actions" aria-label="Messages and bookings">
              <a className="header-primary-action" data-kind="messages" href="#messages" aria-label="Messages">
                <MessageCircle size={20} aria-hidden="true" />
              </a>
              <a className="header-primary-action" data-kind="bookings" href="#bookings" aria-label="Bookings">
                <CalendarCheck size={20} aria-hidden="true" />
              </a>
            </nav>
            <div className="notification-navigation">
              <button type="button" className="notification-trigger" aria-label="Open notifications">
                <Bell size={19} aria-hidden="true" />
              </button>
            </div>
            <div className="account-navigation">
              <button type="button" className="account-menu-trigger" aria-label="Open account navigation">
                {/* Mirrors AccountAvatar, including the verified badge on the header photo. */}
                <span className="account-avatar" data-verified={verified ? 'true' : undefined}>
                  <span className="account-avatar-photo" aria-hidden="true"><User aria-hidden="true" /></span>
                  {verified && (
                    <span className="account-avatar-badge">
                      <BadgeCheck aria-hidden="true" />
                      <span className="sr-only">Identity and Companion profile verified</span>
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <nav className="mobile-primary-nav" aria-label="Mobile primary navigation">
        <a className="mobile-primary-nav-item" data-kind="home" href="#home" aria-current="page">
          <House size={20} aria-hidden="true" />
          <span>Home</span>
        </a>
        <a className="mobile-primary-nav-item" data-kind="discover" href="#discover">
          <Compass size={20} aria-hidden="true" />
          <span>Explore</span>
        </a>
        <a className="mobile-primary-nav-item" data-kind="messages" href="#messages">
          <MessageCircle size={20} aria-hidden="true" />
          <span>Messages</span>
        </a>
        <a className="mobile-primary-nav-item" data-kind="bookings" href="#bookings">
          <CalendarCheck size={20} aria-hidden="true" />
          <span>Bookings</span>
        </a>
        <button type="button" className="mobile-primary-nav-item">
          <UserRound size={20} aria-hidden="true" />
          <span>Account</span>
        </button>
      </nav>
    </div>
  )
}

function displayOf(canvasElement: HTMLElement, selector: string) {
  const element = canvasElement.querySelector(selector)
  if (!element) throw new Error(`Missing ${selector} in the shell markup`)
  return getComputedStyle(element).display
}

const meta = {
  title: 'Web/Templates/App shell chrome',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const DesktopHeader: Story = {
  render: () => <ShellChrome />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('navigation', { name: 'Messages and bookings' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Messages' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Bookings' })).toBeVisible()
    // The rail owns desktop navigation, so the bottom tabs stay out of the way.
    expect(displayOf(canvasElement, '.header-primary-actions')).toBe('flex')
    expect(displayOf(canvasElement, '.mobile-primary-nav')).toBe('none')
  },
}

export const VerifiedHeader: Story = {
  render: () => <ShellChrome verified />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The badge marks the account photo in the header and carries a screen
    // reader label, so the state is not color-and-icon only.
    const badge = canvasElement.querySelector('.account-avatar[data-verified="true"] .account-avatar-badge')
    if (!badge) throw new Error('Missing the verified badge on the header account photo')
    await expect(badge).toBeVisible()
    await expect(canvas.getByText('Identity and Companion profile verified')).toBeInTheDocument()
  },
}

export const MobileHeader: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  render: () => <ShellChrome />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The bottom tabs already carry Messages and Bookings, so the header keeps
    // only notifications and account on small screens.
    expect(displayOf(canvasElement, '.header-primary-actions')).toBe('none')
    expect(displayOf(canvasElement, '.mobile-primary-nav')).toBe('grid')
    await expect(canvas.getByRole('button', { name: 'Open notifications' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Open account navigation' })).toBeVisible()

    const tabs = canvas.getByRole('navigation', { name: 'Mobile primary navigation' })
    for (const label of ['Home', 'Explore', 'Messages', 'Bookings', 'Account']) {
      await expect(within(tabs).getByText(label)).toBeVisible()
    }
  },
}
