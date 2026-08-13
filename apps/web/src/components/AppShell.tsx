import { Link, useRouterState } from '@tanstack/react-router'
import type React from 'react'
import { SignInButton, useAuth } from '@clerk/react'
import { Search } from 'lucide-react'
import { isWorkspacePath } from '../lib/navigation'
import { MeetingSeam, SignedInApplicationChrome } from './AppNavigation'
import { BrandLogo } from './BrandLogo'
import { ThemeToggle } from './ThemeToggle'

const publicNavigation = [
  { to: '/discover', label: 'Explore' },
  { to: '/safety', label: 'How it works' },
  { to: '/become-companion', label: 'Share an experience' },
] as const

export function Header() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { isSignedIn } = useAuth()
  const onboarding = pathname === '/onboarding'

  if (isSignedIn) return <SignedInApplicationChrome onboarding={onboarding} />

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to="/" className="brand-link" aria-label="Let's Be Friends home">
          <BrandLogo className="h-8 w-7" />
          <span>Let&apos;s Be Friends</span>
        </Link>

        {onboarding ? (
          <span className="text-meta hidden sm:inline">Welcome guide</span>
        ) : (
          <nav className="public-nav" aria-label="Primary navigation">
            {publicNavigation.map((item) => (
              <Link key={item.to} to={item.to} className="nav-link" activeProps={{ 'aria-current': 'page' }}>
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="app-header-actions">
          {!onboarding && (
            <Link to="/discover" className="discover-header-link" aria-label="Explore people and experiences">
              <Search size={17} aria-hidden="true" />
              <span>Explore</span>
            </Link>
          )}
          <ThemeToggle />
          <SignInButton mode="modal">
            <button className={isWorkspacePath(pathname) ? 'btn btn-self btn-sm' : 'btn btn-neutral btn-sm'}>Sign in</button>
          </SignInButton>
        </div>
      </div>
    </header>
  )
}

export function Footer() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { isSignedIn } = useAuth()
  if (isSignedIn || isWorkspacePath(pathname) || pathname === '/onboarding') return null

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="flex items-center gap-2">
          <BrandLogo className="h-6 w-5" />
          <span>Let&apos;s Be Friends</span>
          <span className="trust-chip" data-state="awaiting" aria-hidden="true">
            <span className="trust-chip-dot" />
            Early access
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/discover" className="nav-link">Explore</Link>
          <Link to="/safety" className="nav-link">How safety works</Link>
          <Link to="/become-companion" className="nav-link">Share what you enjoy</Link>
          <span className="text-soft">Good company, with safety built in.</span>
        </div>
      </div>
    </footer>
  )
}

type WorkspaceShellProps = {
  title: string
  status?: React.ReactNode
  actions?: React.ReactNode
  toolbar?: React.ReactNode
  rail: React.ReactNode
  mobileNavigation?: React.ReactNode
  railLabel?: string
  variant?: 'default' | 'bookings' | 'companion'
  children: React.ReactNode
}

export function WorkspaceShell({
  title,
  status,
  actions,
  toolbar,
  rail,
  mobileNavigation,
  railLabel,
  variant = 'default',
  children,
}: WorkspaceShellProps) {
  return (
    <main className="workspace" data-variant={variant}>
      <div className="workspace-main">
        <div className="workspace-header">
          <div className="workspace-heading">
            {variant === 'bookings' && <MeetingSeam />}
            <h1 className="text-h1 mt-2">{title}</h1>
            {status && <div className="workspace-status">{status}</div>}
          </div>
          {actions && <div className="workspace-actions">{actions}</div>}
        </div>
        {mobileNavigation && <nav className="workspace-mobile-nav" aria-label={railLabel ?? 'Workspace sections'}>{mobileNavigation}</nav>}
        {toolbar && <div className="workspace-toolbar">{toolbar}</div>}
        <div className="workspace-body">{children}</div>
      </div>
      <aside className="rail" aria-label={railLabel ?? 'Workspace navigation'}>
        {rail}
      </aside>
    </main>
  )
}
