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
  UserCog,
  UsersRound,
} from 'lucide-react'
import type { ReactNode } from 'react'

import type { AdminNavItem, AdminRole } from '../../lib/adminAccess'
import { getAdminNavSections } from '../../lib/adminAccess'
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
          <div>
            <p className="text-tiny">Signed in as</p>
            <p className="admin-user-name">{displayName}</p>
          </div>
          <span className="status-pill" data-tone={viewerRole === 'admin' ? 'success' : undefined}>{viewerRole}</span>
          <ThemeToggle />
          <a className="btn btn-ghost btn-sm" href={userAppHref}>User app</a>
          <button type="button" className="btn btn-neutral btn-sm" onClick={() => { void onSignOut() }}>
            <LogOut size={15} aria-hidden="true" />
            Sign out
          </button>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}
