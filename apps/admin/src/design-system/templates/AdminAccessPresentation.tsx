import { LogOut } from 'lucide-react'
import type React from 'react'
import splashLogoUrl from '../../assets/splash-logo.svg'

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
    return <AdminLoadingPresentation />
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

function AdminLoadingPresentation() {
  return (
    <main className="admin-loading" aria-busy="true">
      <div
        className="admin-loading-inner"
        role="status"
        aria-live="polite"
        aria-atomic="true">
        <img
          className="admin-access-logo"
          src={splashLogoUrl}
          alt="Let's Be Friends"
        />
        <div className="admin-access-copy">
          <p className="eyebrow">Admin workspace</p>
          <h1 className="text-h1">Preparing your workspace</h1>
          <p className="lede">Checking your account and role.</p>
        </div>
        <div className="admin-loading-status" aria-label="Verifying secure access">
          <span className="ds-spinner" aria-hidden="true" />
          <span>Verifying secure access</span>
        </div>
      </div>
    </main>
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
      <div className="admin-standalone-inner">
        <img
          className="admin-access-logo"
          src={splashLogoUrl}
          alt="Let's Be Friends"
        />
        <div className="admin-access-copy">
          <p className="eyebrow">Admin workspace</p>
          <h1 className="text-h1">{title}</h1>
          <p className="lede">{body}</p>
        </div>
        {action && <div className="admin-standalone-action">{action}</div>}
      </div>
    </main>
  )
}
