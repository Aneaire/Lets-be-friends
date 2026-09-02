import { Link, useRouterState } from '@tanstack/react-router'
import { useClerk, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import {
  Bell,
  CalendarCheck,
  CheckCheck,
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
import { api } from '../../../convex/_generated/api'
import { findCompanions } from '../../lib/discoverySearch'
import { activePrimaryNavigation, primaryNavigation } from '../../lib/navigation'
import { formatNotificationTime, webDestination, type NotificationDestination } from '../../lib/notifications'
import { BrandLogo } from '../atoms/BrandLogo'
import { ThemeToggle } from '../atoms/ThemeToggle'
import { NotificationItemContent } from '../molecules/NotificationItemContent'

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type HeaderSearchPerson = {
  _id: string
  userId?: string
  kind?: 'member' | 'companion'
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
  const accountRootRef = useRef<HTMLDivElement>(null)
  const accountPanelRef = useRef<HTMLElement>(null)
  const accountOpenerRef = useRef<HTMLButtonElement | null>(null)
  const searchDirectory = useQuery(api.companions.listExploreDirectory, {}) as HeaderSearchPerson[] | undefined

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
              <HeaderSearch directory={searchDirectory} />
            </div>
          )}

          <div className="app-header-actions">
            {!onboarding && <NotificationNavigation />}
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

export function HeaderSearch({ directory }: { directory: HeaderSearchPerson[] | undefined }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRootRef = useRef<HTMLDivElement>(null)
  const searchResults = searchQuery.trim()
    ? findCompanions(directory ?? [], searchQuery).slice(0, 6)
    : []

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

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
  }

  return (
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
            <p className="app-header-search-guidance">Search members and Companions by username, name, Strength, activity, or city.</p>
          ) : directory === undefined ? (
            <p className="app-header-search-guidance" role="status">Searching...</p>
          ) : searchResults.length === 0 ? (
            <p className="app-header-search-guidance" role="status">No people match "{searchQuery.trim()}".</p>
          ) : (
            <>
              <p className="app-header-search-summary" role="status">
                {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
              </p>
              <ul className="app-header-search-list">
                {searchResults.map((person) => (
                  <li key={`${person.kind ?? 'companion'}:${person._id}`}>
                    {person.kind === 'member' ? (
                      <Link
                        to="/member-profile"
                        search={{ userId: person.userId ?? person._id }}
                        className="app-header-search-result"
                        onClick={closeSearch}
                      >
                        <HeaderSearchIdentity person={person} />
                      </Link>
                    ) : (
                      <Link
                        to="/companion-profile"
                        search={{ companionProfileId: person._id }}
                        className="app-header-search-result"
                        onClick={closeSearch}
                      >
                        <HeaderSearchIdentity person={person} />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function HeaderSearchIdentity({ person }: { person: HeaderSearchPerson }) {
  return (
    <>
      <AccountAvatar imageUrl={person.profileImageUrl} initials={getInitials(person.displayName)} />
      <span>
        <strong>{person.displayName}</strong>
        <small>{[person.username ? `@${person.username}` : undefined, person.city, person.strengths?.[0] ?? person.categories?.[0]].filter(Boolean).join(' · ')}</small>
      </span>
    </>
  )
}

function NotificationNavigation() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const unreadCount = useQuery(api.notifications.unreadCount) ?? 0
  const notifications = useQuery(api.notifications.recent, { limit: 6 })
  const conversations = useQuery(api.conversations.list, {})
  const markRead = useMutation(api.notifications.markRead)
  const markAllRead = useMutation(api.notifications.markAllRead)
  const messagesUnread = conversations?.reduce((total, conversation) => total + conversation.unreadCount, 0) ?? 0

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return <div className="notification-navigation" ref={rootRef}>
    <button ref={triggerRef} type="button" className="notification-trigger" aria-label={unreadCount ? `Open notifications, ${unreadCount} unread` : 'Open notifications'} aria-haspopup="dialog" aria-expanded={open} aria-controls="notification-panel" onClick={() => setOpen((value) => !value)}>
      <Bell size={19} aria-hidden="true" />
      {unreadCount > 0 && <span className="notification-badge tabular">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && <section id="notification-panel" className="notification-panel" role="dialog" aria-label="Latest notifications">
      <header><strong>Notifications</strong><button type="button" disabled={!unreadCount} onClick={() => void markAllRead()}><CheckCheck size={14} aria-hidden="true" />Mark all as read</button></header>
      {messagesUnread > 0 && <Link to="/messages" className="notification-message-summary" onClick={() => setOpen(false)}><MessageCircle size={16} aria-hidden="true" /><span><strong>Messages</strong><small>{messagesUnread} unread {messagesUnread === 1 ? 'message' : 'messages'}</small></span></Link>}
      <div className="notification-panel-list">
        {notifications === undefined ? <p className="notification-panel-state">Loading...</p> : notifications.length === 0 ? <p className="notification-panel-state">You are all caught up.</p> : notifications.map((notification) => {
          const destination = webDestination(notification.destination as NotificationDestination)
          return <Link key={notification.id} {...destination} className="notification-panel-item" onClick={() => {
            setOpen(false)
            if (!notification.readAt) void markRead({ notificationId: notification.id as never })
          }}>
            <NotificationItemContent
              title={notification.title}
              body={notification.body}
              timeLabel={formatNotificationTime(notification.createdAt)}
              dateTime={new Date(notification.createdAt).toISOString()}
              density="compact"
              tone={notification.tone}
              unread={!notification.readAt}
            />
          </Link>
        })}
      </div>
      <Link to="/notifications" className="notification-panel-footer" onClick={() => setOpen(false)}>View all</Link>
    </section>}
  </div>
}

function DesktopPrimaryNavigation({ activeItem }: { activeItem: ReturnType<typeof activePrimaryNavigation> }) {
  const conversations = useQuery(api.conversations.list, {})
  const messagesUnread = conversations?.reduce((total, conversation) => total + conversation.unreadCount, 0) ?? 0
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
            {item.id === 'messages' && messagesUnread > 0 && <span className="primary-nav-badge tabular" aria-label={`${messagesUnread} unread messages`}>{messagesUnread > 99 ? '99+' : messagesUnread}</span>}
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
  const conversations = useQuery(api.conversations.list, {})
  const messagesUnread = conversations?.reduce((total, conversation) => total + conversation.unreadCount, 0) ?? 0
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
          {item.id === 'messages' && messagesUnread > 0 && <span className="mobile-nav-badge tabular" aria-label={`${messagesUnread} unread messages`}>{messagesUnread > 99 ? '99+' : messagesUnread}</span>}
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
  const application = useQuery(api.companions.myApplication)
  const displayName = viewer?.displayName ?? user?.fullName ?? user?.username ?? 'Account'
  const email = user?.primaryEmailAddress?.emailAddress
  const imageUrl = viewer?.profileImageUrl
  const initials = getInitials(displayName)
  const publicProfileSearch = application?.status === 'approved' ? { companionProfileId: application._id } : undefined

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
                <AccountLink to="/companion-profile" search={publicProfileSearch} icon={<UserRound size={17} />} onSelect={() => onClose(false)}>
                  View public Companion profile
                </AccountLink>
              ) : (
                <AccountLink to="/become-companion" icon={<UserRound size={17} />} onSelect={() => onClose(false)}>Companion profile</AccountLink>
              )}
              <AccountLink to="/companion" icon={<UserRoundCog size={17} />} onSelect={() => onClose(false)}>Companion tools</AccountLink>
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

export function AccountAvatar({
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
  to: '/profile' | '/companion-profile' | '/become-companion' | '/companion' | '/settings' | '/safety'
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

function isAccountPath(pathname: string) {
  return pathname === '/profile'
    || pathname === '/settings'
    || pathname === '/become-companion'
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
