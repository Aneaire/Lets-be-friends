import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../web/convex/_generated/api'

export const Route = createFileRoute('/settings')({ component: SettingsPage })

function SettingsPage() {
  const viewer = useQuery(api.users.viewer)
  const overview = useQuery(api.admin.overview, viewer?.role === 'owner' ? {} : 'skip')

  if (viewer && viewer.role !== 'owner') return <div className="admin-empty">Settings are owner-only.</div>

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Read-only</p>
          <h1 className="text-h1 mt-2">Settings</h1>
          <p className="lede mt-2">Platform posture for this phase. Persistent settings come later.</p>
        </div>
      </header>

      <div className="admin-stat-grid">
        <ReadOnlySetting label="Admin app" value="Separate TanStack Start app" />
        <ReadOnlySetting label="Local port" value="3001" />
        <ReadOnlySetting label="Permissions" value="Owner and reviewer split" />
        <ReadOnlySetting label="Categories" value="Code-backed" />
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2 className="text-h2">Current posture</h2>
          <span className="text-meta">Live counts</span>
        </div>
        <div className="panel-body">
          <div className="worklist-row-meta">
            <span>{overview?.counts.usersTotal ?? '...'} users</span>
            <span className="dot" aria-hidden="true" />
            <span>{overview?.counts.usersSuspended ?? '...'} suspended</span>
            <span className="dot" aria-hidden="true" />
            <span>{overview?.counts.postsHidden ?? '...'} hidden posts</span>
            <span className="dot" aria-hidden="true" />
            <span>{overview?.counts.reviewsHidden ?? '...'} hidden reviews</span>
          </div>
        </div>
      </section>
    </>
  )
}

function ReadOnlySetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat-label">{label}</div>
      <div className="text-h3 mt-2">{value}</div>
    </div>
  )
}
