import { SignInButton, useAuth, useClerk, useUser } from '@clerk/react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import type React from 'react'
import { isAdminRole } from '@lets-be-friends/shared'
import { api } from '../../../../web/convex/_generated/api'
import { AdminAccessPresentation } from '../../design-system/templates/AdminAccessPresentation'
import { AdminShellPresentation } from '../../design-system/templates/AdminShellPresentation'
import type { AdminRole } from '../../lib/adminAccess'
import { getAdminGateState } from '../../lib/adminAccess'

const userAppUrl = import.meta.env.VITE_USER_APP_URL ?? 'http://localhost:3005'

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const { user } = useUser()
  const viewer = useQuery(api.users.viewer, isSignedIn ? {} : 'skip')
  const overview = useQuery(api.admin.overview, viewer && isAdminRole(viewer.role) ? {} : 'skip')
  const ensureUser = useMutation(api.users.ensureViewer)
  const state = getAdminGateState({ authLoaded: isLoaded, isSignedIn: Boolean(isSignedIn), viewer })

  const accessProps = {
    userAppHref: `${userAppUrl}/app`,
    onSyncProfile: async () => {
      await ensureUser({
        displayName: user?.fullName ?? user?.username ?? 'Admin user',
      })
    },
    onSignOut: signOut,
  }

  if (state === 'loading') {
    return <AdminAccessPresentation state="loading" {...accessProps} />
  }

  if (state === 'signed_out') {
    return (
      <AdminAccessPresentation
        state="signed_out"
        {...accessProps}
        signInAction={(
          <SignInButton mode="modal">
            <button type="button" className="btn btn-neutral">
              Sign in
            </button>
          </SignInButton>
        )}
      />
    )
  }

  if (state === 'sync_profile') {
    return <AdminAccessPresentation state="sync_profile" {...accessProps} />
  }

  if (state === 'denied' || !viewer || !isAdminRole(viewer.role)) {
    return <AdminAccessPresentation state="denied" {...accessProps} />
  }

  return (
    <AdminShell viewerRole={viewer.role} displayName={viewer.displayName} counts={overview?.counts}>
      {children}
    </AdminShell>
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

  return (
    <AdminShellPresentation
      viewerRole={viewerRole}
      displayName={displayName}
      pathname={pathname}
      counts={counts}
      userAppHref={`${userAppUrl}/app`}
      onSignOut={signOut}
      renderNavLink={({ item, active, children: linkChildren }) => (
        <Link key={item.to} to={item.to} className="admin-nav-link" aria-current={active ? 'page' : undefined}>
          {linkChildren}
        </Link>
      )}>
      {children}
    </AdminShellPresentation>
  )
}
