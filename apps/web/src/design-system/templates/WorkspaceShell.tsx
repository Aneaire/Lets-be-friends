import type React from 'react'

export type WorkspaceShellProps = {
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
            <h1 className="text-h1">{title}</h1>
            {status && <div className="workspace-status">{status}</div>}
          </div>
          {actions && <div className="workspace-actions">{actions}</div>}
        </div>
        {mobileNavigation && (
          <nav
            className="workspace-mobile-nav"
            aria-label={railLabel ?? 'Workspace sections'}>
            {mobileNavigation}
          </nav>
        )}
        {toolbar && <div className="workspace-toolbar">{toolbar}</div>}
        <div className="workspace-body">{children}</div>
      </div>
      <aside
        className="rail"
        aria-label={railLabel ?? 'Workspace navigation'}>
        {rail}
      </aside>
    </main>
  )
}
