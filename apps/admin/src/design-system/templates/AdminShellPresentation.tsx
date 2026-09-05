import {
  BarChart3,
  ClipboardCheck,
  FileText,
  Flag,
  ListChecks,
  LogOut,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SquareArrowOutUpRight,
  UserCog,
  UsersRound,
} from 'lucide-react'
import type { ReactNode } from 'react'

import type { AdminNavItem, AdminRole } from '../../lib/adminAccess'
import { getAdminNavContext, getAdminNavSections } from '../../lib/adminAccess'
import { ThemeToggle } from '../atoms/ThemeToggle'

const iconByRoute: Record<string, ReactNode> = {
  '/overview': <BarChart3 size={16} />,
  '/companion-applications': <ClipboardCheck size={16} />,
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

export type AdminShellNavLinkProps = {
  item: AdminNavItem
  active: boolean
  count?: number
  children: ReactNode
}

export type AdminShellPresentationProps = {
  viewerRole: AdminRole
  displayName: string
  pathname: string
  counts?: Record<string, number>
  children: ReactNode
  userAppHref: string
  onSignOut: () => void | Promise<void>
  logoSrc?: string
  renderNavLink?: (props: AdminShellNavLinkProps) => ReactNode
}

function DefaultNavLink({ item, active, children }: AdminShellNavLinkProps) {
  return (
    <a href={item.to} className="admin-nav-link" aria-current={active ? 'page' : undefined}>
      {children}
    </a>
  )
}

export function AdminShellPresentation({
  viewerRole,
  displayName,
  pathname,
  counts,
  children,
  userAppHref,
  onSignOut,
  logoSrc = '/logo.svg',
  renderNavLink = DefaultNavLink,
}: AdminShellPresentationProps) {
  const navSections = getAdminNavSections(viewerRole)
  const navContext = getAdminNavContext(viewerRole, pathname)

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar-brand">
          <img className="admin-brand-logo" src={logoSrc} alt="" aria-hidden="true" />
          <span>
            <span className="admin-brand-title">Let's Be Friends</span>
            <span className="admin-brand-subtitle">Admin</span>
          </span>
        </div>

        <div className="admin-sidebar-intro">
          <span className="admin-sidebar-kicker">Operations desk</span>
          <p>Review member trust and safety work.</p>
        </div>

        <nav className="admin-nav">
          {navSections.map((section) => (
            <div key={section.title} className="rail-section">
              <div className="rail-section-title">{section.title}</div>
              {section.items.map((item) => {
                const count = item.countKey ? counts?.[item.countKey] : undefined
                const active = pathname === item.to
                return (
                  <div key={item.to} style={{ display: 'contents' }}>
                    {renderNavLink({
                      item,
                      active,
                      count,
                      children: (
                        <>
                          <span className="admin-nav-label">
                            {iconByRoute[item.to]}
                            <span>{item.label}</span>
                          </span>
                          {typeof count === 'number' ? <span className="rail-link-count tabular">{count}</span> : null}
                        </>
                      ),
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-context">
            <p className="admin-topbar-section">{navContext?.section ?? 'Admin'}</p>
            <p className="admin-topbar-title">{navContext?.item.label ?? 'Workspace'}</p>
          </div>
          <div className="admin-topbar-actions">
            <a className="btn btn-ghost btn-sm admin-user-app-link" href={userAppHref} aria-label="Open user app">
              <span>User app</span>
              <SquareArrowOutUpRight size={14} aria-hidden="true" />
            </a>
            <ThemeToggle />
            <div className="admin-account-summary">
              <span className="admin-account-avatar" aria-hidden="true">{getInitials(displayName)}</span>
              <span className="admin-account-copy">
                <span className="admin-user-name">{displayName}</span>
                <span className="admin-account-role">{viewerRole}</span>
              </span>
            </div>
            <button type="button" className="btn btn-neutral btn-sm admin-signout" aria-label="Sign out" onClick={() => { void onSignOut() }}>
              <LogOut size={15} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'A'
}
