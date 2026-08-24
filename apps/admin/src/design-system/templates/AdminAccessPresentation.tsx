import { LogOut } from 'lucide-react'
import type React from 'react'

export type AdminAccessState =
  | 'loading'
  | 'signed_out'
  | 'sync_profile'
  | 'denied'

export function AdminAccessPresentation({
  state,
  signInAction,
  userAppHref,
  onSyncProfile,
  onSignOut,
}: {
  state: AdminAccessState
  signInAction?: React.ReactNode
  userAppHref: string
  onSyncProfile: () => void | Promise<void>
  onSignOut: () => void | Promise<void>
}) {
  if (state === 'loading') {
    return (
      <AdminStandalonePresentation
        title="Loading admin access"
        body="Checking your account and role."
      />
    )
  }

  if (state === 'signed_out') {
    return (
      <AdminStandalonePresentation
        title="Admin sign in"
        body="Admin or reviewer access is required for safety review and moderation."
        action={signInAction}
      />
    )
  }

  if (state === 'sync_profile') {
    return (
      <AdminStandalonePresentation
        title="Sync profile"
        body="Your Clerk account needs a Convex profile before role access can be checked."
        action={(
          <button
            type="button"
            className="btn btn-neutral"
            onClick={() => void onSyncProfile()}>
            Sync profile
          </button>
        )}
      />
    )
  }

  return (
    <AdminStandalonePresentation
      title="Admin access required"
      body="This site is limited to owners and reviewers. Use the member app for bookings, posts, and Companion tools."
      action={(
        <div className="admin-standalone-actions">
          <button
            type="button"
            className="btn btn-neutral"
            onClick={() => void onSignOut()}>
            <LogOut size={16} aria-hidden="true" />
            Sign out and switch account
          </button>
          <a className="btn btn-ghost" href={userAppHref}>
            Open user app
          </a>
        </div>
      )}
    />
  )
}

export function AdminStandalonePresentation({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <main className="admin-standalone">
      <p className="eyebrow">Let&apos;s Be Friends Admin</p>
      <h1 className="text-h1 mt-2">{title}</h1>
      <p className="lede mt-2">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </main>
  )
}
