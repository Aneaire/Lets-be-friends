import { Link, useRouterState } from '@tanstack/react-router'
import type React from 'react'
import { SignInButton, UserButton, useAuth } from '@clerk/react'
import { BrandLogo } from './BrandLogo'
import { ThemeToggle } from './ThemeToggle'

const workspaceRoutes = ['/app', '/host', '/admin']

function useSurface(): 'marketing' | 'workspace' {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return workspaceRoutes.some((prefix) => pathname.startsWith(prefix)) ? 'workspace' : 'marketing'
}

const marketingNav = [
  { to: '/discover', label: 'Discover' },
  { to: '/become-host', label: 'Host' },
  { to: '/safety', label: 'Safety' },
] as const

export function Header() {
  const surface = useSurface()
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to="/" className="brand-link">
          <BrandLogo className="h-8 w-7" />
          <span>Let&apos;s Be Friends</span>
        </Link>

        {surface === 'marketing' ? (
          <nav className="nav-row hidden md:flex">
            {marketingNav.map((item) => (
              <Link key={item.to} to={item.to} className="nav-link" activeProps={{ 'aria-current': 'page' }}>
                {item.label}
              </Link>
            ))}
          </nav>
        ) : (
          <nav className="nav-row hidden md:flex">
            <span className="text-meta">Workspace</span>
            <span className="nav-divider" aria-hidden="true" />
            <WorkspaceTopLinks />
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {surface === 'marketing' && (
            <Link to="/discover" className="btn btn-ghost hidden md:inline-flex">
              Find a host
            </Link>
          )}
          <ThemeToggle />
          <AuthButtons surface={surface} />
        </div>
      </div>
    </header>
  )
}

function WorkspaceTopLinks() {
  return (
    <>
      <Link to="/app" search={{}} className="nav-link" activeProps={{ 'aria-current': 'page' }}>
        Member
      </Link>
      <Link to="/host" className="nav-link" activeProps={{ 'aria-current': 'page' }}>
        Host
      </Link>
      <AuthOnly>
        <Link to="/admin" className="nav-link" activeProps={{ 'aria-current': 'page' }}>
          Admin
        </Link>
      </AuthOnly>
    </>
  )
}

export function Footer() {
  const surface = useSurface()
  if (surface === 'workspace') return null
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="flex items-center gap-2">
          <BrandLogo className="h-6 w-5" />
          <span>Let&apos;s Be Friends</span>
          <span className="trust-chip" data-state="awaiting" aria-hidden="true">
            <span className="trust-chip-dot" />
            18+ MVP
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/safety" className="nav-link">Safety model</Link>
          <Link to="/become-host" className="nav-link">Become a host</Link>
          <span className="text-soft">Verification before booking.</span>
        </div>
      </div>
    </footer>
  )
}

function AuthOnly({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth()
  return isSignedIn ? <>{children}</> : null
}

function AuthButtons({ surface }: { surface: 'marketing' | 'workspace' }) {
  const { isSignedIn } = useAuth()
  if (isSignedIn) return <UserButton />
  if (surface === 'workspace') {
    return (
      <SignInButton mode="modal">
        <button className="btn btn-self btn-sm">Sign in</button>
      </SignInButton>
    )
  }
  return (
    <SignInButton mode="modal">
      <button className="btn btn-neutral btn-sm">Sign in</button>
    </SignInButton>
  )
}

type WorkspaceShellProps = {
  title: string
  eyebrow?: string
  description?: React.ReactNode
  actions?: React.ReactNode
  toolbar?: React.ReactNode
  rail: React.ReactNode
  railLabel?: string
  children: React.ReactNode
}

export function WorkspaceShell({
  title,
  eyebrow,
  description,
  actions,
  toolbar,
  rail,
  railLabel,
  children,
}: WorkspaceShellProps) {
  return (
    <div className="workspace">
      <aside className="rail" aria-label={railLabel ?? 'Workspace navigation'}>
        {rail}
      </aside>
      <div className="workspace-main">
        <div className="workspace-header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="text-h1 mt-2">{title}</h1>
            {description && <p className="lede mt-2 max-w-[64ch]">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {toolbar && <div className="workspace-toolbar">{toolbar}</div>}
        <div className="workspace-body">{children}</div>
      </div>
    </div>
  )
}
