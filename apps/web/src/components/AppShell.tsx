import { Link, useRouterState } from '@tanstack/react-router'
import type React from 'react'
import { SignInButton, useAuth } from '@clerk/react'
import { Search } from 'lucide-react'
import { isWorkspacePath } from '../lib/navigation'
import { MeetingSeam, SignedInApplicationChrome } from './AppNavigation'
import { BrandLogo } from './BrandLogo'
import { ThemeToggle } from './ThemeToggle'

const publicNavigation = [
  { to: '/discover', label: 'Discover' },
  { to: '/become-host', label: 'Become a Friend Host' },
  { to: '/safety', label: 'Safety' },
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
            <Link to="/discover" className="discover-header-link" aria-label="Discover Friend Hosts">
              <Search size={17} aria-hidden="true" />
              <span>Discover</span>
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
          <Link to="/safety" className="nav-link">Safety model</Link>
          <Link to="/become-host" className="nav-link">Become a Friend Host</Link>
          <span className="text-soft">Verification before booking.</span>
        </div>
      </div>
    </footer>
  )
}

type WorkspaceShellProps = {
  title: string
  eyebrow?: string
  description?: React.ReactNode
  status?: React.ReactNode
  actions?: React.ReactNode
  toolbar?: React.ReactNode
  rail: React.ReactNode
  mobileNavigation?: React.ReactNode
  railLabel?: string
  variant?: 'default' | 'bookings' | 'hosting'
  children: React.ReactNode
}

export function WorkspaceShell({
  title,
  eyebrow,
  description,
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
      <aside className="rail" aria-label={railLabel ?? 'Workspace navigation'}>
        {rail}
      </aside>
      <div className="workspace-main">
        <div className="workspace-header">
          <div className="workspace-heading">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {variant === 'bookings' && <MeetingSeam />}
            <h1 className="text-h1 mt-2">{title}</h1>
            {description && <p className="lede mt-2 max-w-[64ch]">{description}</p>}
            {status && <div className="workspace-status">{status}</div>}
          </div>
          {actions && <div className="workspace-actions">{actions}</div>}
        </div>
        {mobileNavigation && <nav className="workspace-mobile-nav" aria-label={railLabel ?? 'Workspace sections'}>{mobileNavigation}</nav>}
        {toolbar && <div className="workspace-toolbar">{toolbar}</div>}
        <div className="workspace-body">{children}</div>
      </div>
    </main>
  )
}
