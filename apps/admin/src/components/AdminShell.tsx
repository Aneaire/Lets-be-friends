import { SignInButton, useAuth, useClerk, useUser } from '@clerk/react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { BarChart3, ClipboardCheck, FileText, Flag, ListChecks, LogOut, Moon, Settings, ShieldAlert, ShieldCheck, Sun, UserCog, UsersRound } from 'lucide-react'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { isAdminRole } from '@lets-be-friends/shared'
import { api } from '../../../web/convex/_generated/api'
import type { AdminNavItem, AdminRole } from '../lib/adminAccess'
import { getAdminGateState, getAdminNavSections } from '../lib/adminAccess'

const userAppUrl = import.meta.env.VITE_USER_APP_URL ?? 'http://localhost:3000'

const iconByRoute: Record<string, React.ReactNode> = {
  '/overview': <BarChart3 size={16} />,
  '/host-applications': <ClipboardCheck size={16} />,
  '/booking-verification': <ShieldCheck size={16} />,
  '/reports': <Flag size={16} />,
  '/users': <UsersRound size={16} />,
  '/posts': <FileText size={16} />,
  '/reviews': <ListChecks size={16} />,
  '/profile': <UserCog size={16} />,
  '/categories': <ListChecks size={16} />,
  '/audit-logs': <ShieldAlert size={16} />,
  '/settings': <Settings size={16} />,
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const { user } = useUser()
  const viewer = useQuery(api.users.viewer, isSignedIn ? {} : 'skip')
  const overview = useQuery(api.admin.overview, viewer && isAdminRole(viewer.role) ? {} : 'skip')
  const ensureUser = useMutation(api.users.ensureViewer)
  const state = getAdminGateState({ authLoaded: isLoaded, isSignedIn: Boolean(isSignedIn), viewer })

  if (state === 'loading') return <AdminStandalone title="Loading admin access" body="Checking your account and role." />

  if (state === 'signed_out') {
    return (
      <AdminStandalone
        title="Admin sign in"
        body="Admin or reviewer access is required for safety review and moderation."
        action={(
          <SignInButton mode="modal">
            <button className="btn btn-neutral">Sign in</button>
          </SignInButton>
        )}
      />
    )
  }

  if (state === 'sync_profile') {
    return (
      <AdminStandalone
        title="Sync profile"
        body="Your Clerk account needs a Convex profile before role access can be checked."
        action={(
          <button
            className="btn btn-neutral"
            onClick={() => ensureUser({ displayName: user?.fullName ?? user?.username ?? 'Admin user' })}
          >
            Sync profile
          </button>
        )}
      />
    )
  }

  if (state === 'denied' || !viewer || !isAdminRole(viewer.role)) {
    return (
      <AdminStandalone
        title="Admin access required"
        body="This site is limited to owners and reviewers. Use the member app for bookings, posts, and Friend Host tools."
        action={(
          <div className="admin-standalone-actions">
            <button type="button" className="btn btn-neutral" onClick={() => void signOut()}>
              <LogOut size={16} aria-hidden="true" />
              Sign out and switch account
            </button>
            <a className="btn btn-ghost" href={`${userAppUrl}/app`}>Open user app</a>
          </div>
        )}
      />
    )
  }

  return (
    <AdminShell viewerRole={viewer.role} displayName={viewer.displayName} counts={overview?.counts}>
      {children}
    </AdminShell>
  )
}

function AdminStandalone({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <main className="admin-standalone">
      <p className="eyebrow">Let's Be Friends Admin</p>
      <h1 className="text-h1 mt-2">{title}</h1>
      <p className="lede mt-2">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </main>
  )
}

function AdminShell({
  viewerRole,
  displayName,
  counts,
  children,
}: {
  viewerRole: AdminRole
  displayName: string
  counts?: Record<string, number>
  children: React.ReactNode
}) {
  const { signOut } = useClerk()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navSections = useMemo(() => getAdminNavSections(viewerRole), [viewerRole])

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar-brand">
          <img className="admin-brand-logo" src="/logo.svg" alt="" aria-hidden="true" />
          <span>
            <span className="admin-brand-title">Let's Be Friends</span>
            <span className="admin-brand-subtitle">Admin</span>
          </span>
        </div>

        <nav className="admin-nav">
          {navSections.map((section) => (
            <div key={section.title} className="rail-section">
              <div className="rail-section-title">{section.title}</div>
              {section.items.map((item) => (
                <AdminNavLink
                  key={item.to}
                  item={item}
                  active={pathname === item.to}
                  count={item.countKey ? counts?.[item.countKey] : undefined}
                />
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="text-tiny">Signed in as</p>
            <p className="admin-user-name">{displayName}</p>
          </div>
          <span className="status-pill" data-tone={viewerRole === 'admin' ? 'success' : undefined}>{viewerRole}</span>
          <ThemeToggle />
          <a className="btn btn-ghost btn-sm" href={`${userAppUrl}/app`}>User app</a>
          <button type="button" className="btn btn-neutral btn-sm" onClick={() => void signOut()}>
            <LogOut size={15} aria-hidden="true" />
            Sign out
          </button>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}

function AdminNavLink({ item, active, count }: { item: AdminNavItem; active: boolean; count?: number }) {
  return (
    <Link to={item.to} className="admin-nav-link" aria-current={active ? 'page' : undefined}>
      <span className="admin-nav-label">
        {iconByRoute[item.to]}
        <span>{item.label}</span>
      </span>
      {typeof count === 'number' && <span className="rail-link-count tabular">{count}</span>}
    </Link>
  )
}

function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  return (
    <button
      type="button"
      className="admin-icon-button"
      aria-label={dark ? 'Use light theme' : 'Use dark theme'}
      onClick={() => {
        const next = !dark
        document.documentElement.classList.toggle('dark', next)
        document.documentElement.dataset.theme = next ? 'dark' : 'light'
        localStorage.setItem('lets-be-friends-theme', next ? 'dark' : 'light')
        setDark(next)
      }}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
