import { useUser } from '@clerk/react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../web/convex/_generated/api'

export const Route = createFileRoute('/profile')({ component: ProfilePage })

function ProfilePage() {
  const { user } = useUser()
  const viewer = useQuery(api.users.viewer)
  const email = user?.primaryEmailAddress?.emailAddress ?? 'No primary email'
  const clerkName = user?.fullName ?? user?.username ?? 'No Clerk name'
  const imageUrl = viewer?.profileImageUrl ?? user?.imageUrl

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="text-h1 mt-2">Profile</h1>
          <p className="lede mt-2">Current admin identity from Clerk and Convex.</p>
        </div>
      </header>

      <section className="admin-profile-layout">
        <div className="panel">
          <div className="panel-body admin-profile-card">
            <span className="admin-profile-avatar" aria-hidden="true">
              {imageUrl ? <img src={imageUrl} alt="" /> : <span>{initials(viewer?.displayName ?? clerkName)}</span>}
            </span>
            <div className="min-w-0">
              <h2 className="text-h2">{viewer?.displayName ?? clerkName}</h2>
              <p className="text-meta mt-1">{email}</p>
              <div className="worklist-row-meta mt-3">
                <span className="status-pill" data-tone={viewer?.role === 'admin' ? 'success' : undefined}>
                  {viewer?.role ?? 'loading'}
                </span>
                <span className="status-pill" data-tone={viewer?.suspended ? 'danger' : 'success'}>
                  {viewer?.suspended ? 'suspended' : 'active'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <section className="panel">
          <div className="panel-header">
            <h2 className="text-h2">Convex profile</h2>
          </div>
          <dl className="admin-profile-details">
            <Detail label="Display name" value={viewer?.displayName} />
            <Detail label="Role" value={viewer?.role} />
            <Detail label="Verification" value={viewer?.verificationStatus} />
            <Detail label="Suspended" value={viewer ? String(viewer.suspended) : undefined} />
            <Detail label="User id" value={viewer?._id} code />
            <Detail label="Clerk user id" value={viewer?.clerkUserId} code />
          </dl>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="text-h2">Clerk account</h2>
          </div>
          <dl className="admin-profile-details">
            <Detail label="Name" value={clerkName} />
            <Detail label="Email" value={email} />
            <Detail label="Username" value={user?.username ?? undefined} />
            <Detail label="Clerk id" value={user?.id} code />
            <Detail label="Last sign in" value={user?.lastSignInAt ? formatDate(user.lastSignInAt) : undefined} />
          </dl>
        </section>
      </section>
    </>
  )
}

function Detail({ label, value, code = false }: { label: string; value?: string; code?: boolean }) {
  return (
    <div className="admin-profile-detail">
      <dt>{label}</dt>
      <dd className={code ? 'admin-code' : undefined}>{value ?? 'Loading...'}</dd>
    </div>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'A'
}

function formatDate(value: Date) {
  return value.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
