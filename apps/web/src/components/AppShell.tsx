import { Link, useRouterState } from '@tanstack/react-router'
import type React from 'react'
import { SignInButton, useAuth, useClerk, useUser } from '@clerk/react'
import { useQuery } from 'convex/react'
import { CalendarCheck, Compass, LogOut, MessageCircle, Search, ShieldCheck, UserRound, UserRoundCog } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { BrandLogo } from './BrandLogo'
import { ThemeToggle } from './ThemeToggle'

export const workspaceRoutes = ['/app', '/profile', '/host'] as const

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
  const { isSignedIn } = useAuth()
  const visibleMarketingNav = isSignedIn
    ? marketingNav.filter((item) => item.to !== '/safety')
    : marketingNav

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to="/" className="brand-link">
          <BrandLogo className="h-8 w-7" />
          <span>Let&apos;s Be Friends</span>
        </Link>

        {surface === 'marketing' ? (
          <nav className="nav-row hidden md:flex">
            {visibleMarketingNav.map((item) => (
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
            <Link to="/discover" className="discover-header-link" aria-label="Discover Friend Hosts">
              <Search size={16} aria-hidden="true" />
              <span>Discover</span>
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
      <Link to="/profile" className="nav-link" activeProps={{ 'aria-current': 'page' }}>
        Profile
      </Link>
      <Link to="/host" className="nav-link" activeProps={{ 'aria-current': 'page' }}>
        Host
      </Link>
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
            Early access
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

function AuthButtons({ surface }: { surface: 'marketing' | 'workspace' }) {
  const { isSignedIn } = useAuth()
  if (isSignedIn) return <AccountMenu />
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

function AccountMenu() {
  const { signOut } = useClerk()
  const { user } = useUser()
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const viewer = useQuery(api.users.viewer)
  const application = useQuery(api.hosts.myApplication)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const displayName = viewer?.displayName ?? user?.fullName ?? user?.username ?? 'Account'
  const email = user?.primaryEmailAddress?.emailAddress
  const imageUrl = viewer?.profileImageUrl ?? user?.imageUrl
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A'
  const publicProfileSearch =
    application?.status === 'approved' ? { hostProfileId: application._id } : undefined

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <AccountAvatar imageUrl={imageUrl} initials={initials} />
      </button>

      {open && (
        <div className="account-menu-panel" role="menu">
          <div className="account-menu-identity">
            <AccountAvatar imageUrl={imageUrl} initials={initials} size="lg" />
            <span className="min-w-0">
              <span className="account-menu-name">{displayName}</span>
              {email && <span className="account-menu-email">{email}</span>}
            </span>
          </div>

          <div className="account-menu-group">
            <AccountMenuLink to="/app" icon={<CalendarCheck size={16} />} onSelect={() => setOpen(false)}>
              Member workspace
            </AccountMenuLink>
            <AccountMenuLink to="/discover" icon={<Compass size={16} />} onSelect={() => setOpen(false)}>
              Discover Friend Hosts
            </AccountMenuLink>
            <AccountMenuLink to="/social" icon={<MessageCircle size={16} />} onSelect={() => setOpen(false)}>
              Community posts
            </AccountMenuLink>
          </div>

          <div className="account-menu-group">
            <AccountMenuLink to="/profile" icon={<UserRound size={16} />} onSelect={() => setOpen(false)}>
              Profile
            </AccountMenuLink>
            {publicProfileSearch ? (
              <AccountMenuLink
                to="/host-profile"
                search={publicProfileSearch}
                icon={<UserRound size={16} />}
                onSelect={() => setOpen(false)}
              >
                Public host profile
              </AccountMenuLink>
            ) : (
              <AccountMenuLink to="/become-host" icon={<UserRound size={16} />} onSelect={() => setOpen(false)}>
                Host profile
              </AccountMenuLink>
            )}
            <AccountMenuLink to="/host" icon={<UserRoundCog size={16} />} onSelect={() => setOpen(false)}>
              Friend Host workspace
            </AccountMenuLink>
            <AccountMenuLink to="/safety" icon={<ShieldCheck size={16} />} onSelect={() => setOpen(false)}>
              Safety model
            </AccountMenuLink>
          </div>

          <button
            type="button"
            className="account-menu-item account-menu-signout"
            role="menuitem"
            onClick={() => void signOut()}
          >
            <LogOut size={16} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  )
}

function AccountAvatar({
  imageUrl,
  initials,
  size = 'default',
}: {
  imageUrl?: string
  initials: string
  size?: 'default' | 'lg'
}) {
  return (
    <span className={size === 'lg' ? 'account-avatar account-avatar-lg' : 'account-avatar'} aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" /> : <span>{initials}</span>}
    </span>
  )
}

function AccountMenuLink({
  to,
  search,
  icon,
  children,
  onSelect,
}: {
  to: '/app' | '/discover' | '/social' | '/profile' | '/host-profile' | '/become-host' | '/host' | '/safety'
  search?: Record<string, string>
  icon: React.ReactNode
  children: React.ReactNode
  onSelect: () => void
}) {
  return (
    <Link to={to} search={search} className="account-menu-item" role="menuitem" onClick={onSelect}>
      {icon}
      <span>{children}</span>
    </Link>
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
