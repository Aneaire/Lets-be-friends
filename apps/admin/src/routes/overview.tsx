import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../web/convex/_generated/api'

export const Route = createFileRoute('/overview')({ component: OverviewPage })

function OverviewPage() {
  const overview = useQuery(api.admin.overview)
  const counts = overview?.counts

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Trust operations</p>
          <h1 className="text-h1 mt-2">Overview</h1>
          <p className="lede mt-2">Open safety review work, moderation posture, and recent audit activity.</p>
        </div>
      </header>

      <section className="admin-stat-grid" aria-label="Admin posture">
        <Stat label="Companion profile reviews" value={counts?.companionApplicationsPending} />
        <Stat label="Identity reviews" value={counts?.memberVerificationsPending} />
        <Stat label="Open reports" value={counts?.reportsOpen} />
        <Stat label="Suspended users" value={counts?.usersSuspended} />
      </section>

      <section>
        <header className="mb-3">
          <h2 className="text-h2">Recent audit</h2>
          <p className="text-meta mt-1">Latest actions across safety review and moderation.</p>
        </header>
        {overview === undefined ? (
          <div className="admin-empty">Loading audit activity...</div>
        ) : overview.recentAuditLogs.length === 0 ? (
          <div className="admin-empty">No audit activity yet.</div>
        ) : (
          <div className="panel">
            <div className="worklist">
              {overview.recentAuditLogs.map((log) => (
                <article key={log._id} className="worklist-row">
                  <div className="worklist-row-head">
                    <div>
                      <h3 className="text-h3">{log.action}</h3>
                      <div className="worklist-row-meta">
                        <span>{log.actorDisplayName}</span>
                        <span className="dot" aria-hidden="true" />
                        <span>{log.targetType}</span>
                        {log.targetId && (
                          <>
                            <span className="dot" aria-hidden="true" />
                            <span className="admin-code">{String(log.targetId)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-tiny tabular">{formatTime(log.createdAt)}</span>
                  </div>
                  {log.note && <p className="text-meta">{log.note}</p>}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat-label">{label}</div>
      <div className="admin-stat-value">{value ?? '...'}</div>
    </div>
  )
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
