import { Link, useRouterState } from '@tanstack/react-router'
import { useClerk, useUser } from '@clerk/react'
import { useQuery } from 'convex/react'
import {
  CalendarCheck,
  Compass,
  House,
  LogOut,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  UserRoundCog,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { api } from '../../convex/_generated/api'
import { findFriendHosts } from '../lib/discoverySearch'
import { activePrimaryNavigation, primaryNavigation } from '../lib/navigation'
import { BrandLogo } from './BrandLogo'
import { ThemeToggle } from './ThemeToggle'

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

type HeaderSearchHost = {
  _id: string
  username?: string
  displayName: string
  city: string
  intro: string
  bio?: string
  strengths?: string[]
  categories?: string[]
  profileImageUrl?: string
}

export function SignedInApplicationChrome({ onboarding }: { onboarding: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const activeItem = activePrimaryNavigation(pathname)
  const [accountOpen, setAccountOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const accountRootRef = useRef<HTMLDivElement>(null)
  const accountPanelRef = useRef<HTMLElement>(null)
  const accountOpenerRef = useRef<HTMLButtonElement | null>(null)
  const searchRootRef = useRef<HTMLDivElement>(null)
  const searchHosts = useQuery(api.hosts.listApproved, {}) as HeaderSearchHost[] | undefined
  const searchResults = searchQuery.trim()
    ? findFriendHosts(searchHosts ?? [], searchQuery).slice(0, 6)
    : []

  const closeAccount = useCallback((restoreFocus = true) => {
    setAccountOpen(false)
    if (restoreFocus) requestAnimationFrame(() => accountOpenerRef.current?.focus())
  }, [])

  const openAccount = useCallback((opener: HTMLButtonElement) => {
    accountOpenerRef.current = opener
    setAccountOpen(true)
  }, [])

  useEffect(() => {
    if (!accountOpen) return
    const mobile = window.matchMedia('(max-width: 767px)').matches
    const previousOverflow = document.body.style.overflow
    if (mobile) document.body.style.overflow = 'hidden'

    requestAnimationFrame(() => {
      const controls = Array.from(accountPanelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
      controls.find((control) => control.getClientRects().length > 0)?.focus()
    })

    function onPointerDown(event: PointerEvent) {
      if (!mobile && !accountRootRef.current?.contains(event.target as Node)) closeAccount(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeAccount()
        return
      }
      if (!mobile || event.key !== 'Tab' || !accountPanelRef.current) return
      const controls = Array.from(accountPanelRef.current.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((control) => control.getClientRects().length > 0)
      if (controls.length === 0) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen, closeAccount])

  useEffect(() => {
    if (!searchOpen) return

    function onPointerDown(event: PointerEvent) {
      if (!searchRootRef.current?.contains(event.target as Node)) setSearchOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSearchOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [searchOpen])

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="brand-link" aria-label="Let's Be Friends home">
            <BrandLogo className="h-8 w-7" />
            <span>Let&apos;s Be Friends</span>
          </Link>

          {onboarding ? (
            <span className="app-header-context">Welcome guide</span>
          ) : (
            <div className="app-header-context">
              <strong>{primaryNavigation.find((item) => item.id === activeItem)?.label ?? 'Account'}</strong>
              <div className="app-header-search-root" ref={searchRootRef}>
                <div className="app-header-search" role="search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    type="search"
                    value={searchQuery}
                    placeholder="Search username, people, Strengths, or activities"
                    aria-label="Search username, people, Strengths, or activities"
                    aria-expanded={searchOpen}
                    aria-controls="header-search-results"
                    autoComplete="off"
                    onFocus={() => setSearchOpen(true)}
                    onChange={(event) => {
                      setSearchQuery(event.currentTarget.value)
                      setSearchOpen(true)
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="app-header-search-clear"
                      aria-label="Clear search"
                      onClick={() => setSearchQuery('')}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>

                {searchOpen && (
                  <div id="header-search-results" className="app-header-search-panel">
                    {!searchQuery.trim() ? (
                    <p className="app-header-search-guidance">Search Friend Hosts by username, name, Strength, activity, or city.</p>
                    ) : searchHosts === undefined ? (
                      <p className="app-header-search-guidance" role="status">Searching…</p>
                    ) : searchResults.length === 0 ? (
                      <p className="app-header-search-guidance" role="status">No Friend Hosts match “{searchQuery.trim()}”.</p>
                    ) : (
                      <>
                        <p className="app-header-search-summary" role="status">
                          {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
                        </p>
                        <ul className="app-header-search-list">
                          {searchResults.map((host) => (
                            <li key={host._id}>
                              <Link
                                to="/host-profile"
                                search={{ hostProfileId: host._id }}
                                className="app-header-search-result"
                                onClick={() => {
                                  setSearchOpen(false)
                                  setSearchQuery('')
                                }}
                              >
                                <AccountAvatar imageUrl={host.profileImageUrl} initials={getInitials(host.displayName)} />
                                <span>
                                  <strong>{host.displayName}</strong>
                                  <small>{[host.username ? `@${host.username}` : undefined, host.city, host.strengths?.[0] ?? host.categories?.[0]].filter(Boolean).join(' · ')}</small>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="app-header-actions">
            <ThemeToggle />
            <AccountNavigation
              open={accountOpen}
              onOpen={openAccount}
              onClose={closeAccount}
              rootRef={accountRootRef}
              panelRef={accountPanelRef}
            />
          </div>
        </div>
      </header>

      {!onboarding && (
        <>
          <DesktopPrimaryNavigation activeItem={activeItem} />
          <MobilePrimaryNavigation
            activeItem={activeItem}
            accountOpen={accountOpen}
            onOpenAccount={openAccount}
            accountActive={isAccountPath(pathname)}
          />
        </>
      )}
    </>
  )
}

function DesktopPrimaryNavigation({ activeItem }: { activeItem: ReturnType<typeof activePrimaryNavigation> }) {
  return (
    <aside className="desktop-primary-rail">
      <nav className="primary-nav" aria-label="Primary navigation">
        {primaryNavigation.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            search={item.to === '/app' ? {} : undefined}
            className="primary-nav-link"
            data-kind={item.id}
            aria-current={activeItem === item.id ? 'page' : undefined}
          >
            <NavigationIcon id={item.id} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <p className="primary-rail-note">Find useful company, review trust, then make a clear plan.</p>
    </aside>
  )
}

function MobilePrimaryNavigation({
  activeItem,
  accountOpen,
  accountActive,
  onOpenAccount,
}: {
  activeItem: ReturnType<typeof activePrimaryNavigation>
  accountOpen: boolean
  accountActive: boolean
  onOpenAccount: (opener: HTMLButtonElement) => void
}) {
  return (
    <nav className="mobile-primary-nav" aria-label="Mobile primary navigation">
      {primaryNavigation.map((item) => (
        <Link
          key={item.id}
          to={item.to}
          search={item.to === '/app' ? {} : undefined}
          className="mobile-primary-nav-item"
          data-kind={item.id}
          aria-current={activeItem === item.id ? 'page' : undefined}
        >
          <NavigationIcon id={item.id} />
          <span>{item.label}</span>
        </Link>
      ))}
      <button
        type="button"
        className="mobile-primary-nav-item"
        data-active={accountOpen || accountActive}
        aria-expanded={accountOpen}
        aria-controls="account-navigation-panel"
        onClick={(event) => onOpenAccount(event.currentTarget)}
      >
        <UserRound size={20} aria-hidden="true" />
        <span>Account</span>
      </button>
    </nav>
  )
}

function NavigationIcon({ id }: { id: (typeof primaryNavigation)[number]['id'] }) {
  if (id === 'home') return <House size={20} aria-hidden="true" />
  if (id === 'discover') return <Compass size={20} aria-hidden="true" />
  if (id === 'messages') return <MessageCircle size={20} aria-hidden="true" />
  if (id === 'bookings') return <CalendarCheck size={20} aria-hidden="true" />
  return <UserRoundCog size={20} aria-hidden="true" />
}

function AccountNavigation({
  open,
  onOpen,
  onClose,
  rootRef,
  panelRef,
}: {
  open: boolean
  onOpen: (opener: HTMLButtonElement) => void
  onClose: (restoreFocus?: boolean) => void
  rootRef: React.RefObject<HTMLDivElement | null>
  panelRef: React.RefObject<HTMLElement | null>
}) {
  const { signOut } = useClerk()
  const { user } = useUser()
  const viewer = useQuery(api.users.viewer)
  const application = useQuery(api.hosts.myApplication)
  const displayName = viewer?.displayName ?? user?.fullName ?? user?.username ?? 'Account'
  const email = user?.primaryEmailAddress?.emailAddress
  const imageUrl = viewer?.profileImageUrl ?? user?.imageUrl
  const initials = getInitials(displayName)
  const publicProfileSearch = application?.status === 'approved' ? { hostProfileId: application._id } : undefined

  return (
    <div className="account-navigation" ref={rootRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-label="Open account navigation"
        aria-expanded={open}
        aria-controls="account-navigation-panel"
        onClick={(event) => open ? onClose() : onOpen(event.currentTarget)}
      >
        <AccountAvatar imageUrl={imageUrl} initials={initials} />
      </button>

      {open && (
        <div className="account-navigation-layer">
          <button
            type="button"
            className="account-navigation-backdrop"
            aria-label="Close account navigation"
            onClick={() => onClose()}
          />
          <nav
            ref={panelRef}
            id="account-navigation-panel"
            className="account-menu-panel"
            aria-label="Account navigation"
          >
            <div className="account-menu-heading">
              <span className="account-menu-mobile-title">Account</span>
              <button type="button" className="account-menu-close" onClick={() => onClose()} aria-label="Close account navigation">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="account-menu-identity">
              <AccountAvatar imageUrl={imageUrl} initials={initials} size="lg" />
              <span className="min-w-0">
                <span className="account-menu-name">{displayName}</span>
                {email && <span className="account-menu-email">{email}</span>}
              </span>
            </div>

            <div className="account-menu-group">
              <AccountLink to="/profile" icon={<UserRound size={17} />} onSelect={() => onClose(false)}>Edit profile</AccountLink>
              {publicProfileSearch ? (
                <AccountLink to="/host-profile" search={publicProfileSearch} icon={<UserRound size={17} />} onSelect={() => onClose(false)}>
                  View public host profile
                </AccountLink>
              ) : (
                <AccountLink to="/become-host" icon={<UserRound size={17} />} onSelect={() => onClose(false)}>Host profile</AccountLink>
              )}
              <AccountLink to="/host" icon={<UserRoundCog size={17} />} onSelect={() => onClose(false)}>Hosting</AccountLink>
              <AccountLink to="/settings" icon={<Settings size={17} />} onSelect={() => onClose(false)}>Settings</AccountLink>
            </div>

            <div className="account-menu-group account-menu-support">
              <AccountLink to="/safety" icon={<ShieldCheck size={17} />} onSelect={() => onClose(false)}>Safety and help</AccountLink>
            </div>

            <button
              type="button"
              className="account-menu-item account-menu-signout"
              onClick={() => {
                onClose(false)
                void signOut()
              }}
            >
              <LogOut size={17} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </nav>
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

function AccountLink({
  to,
  search,
  icon,
  children,
  onSelect,
}: {
  to: '/profile' | '/host-profile' | '/become-host' | '/host' | '/settings' | '/safety'
  search?: Record<string, string>
  icon: React.ReactNode
  children: React.ReactNode
  onSelect: () => void
}) {
  return (
    <Link to={to} search={search} className="account-menu-item" onClick={onSelect}>
      {icon}
      <span>{children}</span>
    </Link>
  )
}

export function MeetingSeam() {
  return (
    <span className="meeting-seam" aria-hidden="true">
      <span className="meeting-seam-self" />
      <span className="meeting-seam-track"><span className="meeting-seam-notch" /></span>
      <span className="meeting-seam-social" />
    </span>
  )
}

function isAccountPath(pathname: string) {
  return pathname === '/profile'
    || pathname === '/settings'
    || pathname === '/become-host'
    || pathname === '/onboarding'
    || pathname === '/safety'
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A'
}
