import { ArrowRight, ClipboardCheck, Flag, ShieldCheck, UsersRound } from 'lucide-react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import type { ReactNode } from 'react'
import { api } from '../../../web/convex/_generated/api'

export const Route = createFileRoute('/overview')({ component: OverviewPage })

function OverviewPage() {
  const overview = useQuery(api.admin.overview)
  const counts = overview?.counts

  return (
    <>
      <header className="admin-page-header admin-overview-header">
        <div>
          <p className="eyebrow">Trust operations</p>
          <h1 className="text-h1 mt-2">Your work starts here.</h1>
          <p className="lede mt-2">Review open queues, then check the latest admin activity.</p>
        </div>
      </header>

      <section className="admin-queue-section" aria-labelledby="open-work-heading">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">Priority queues</p>
            <h2 className="text-h2" id="open-work-heading">Open work</h2>
          </div>
          <p className="text-meta">Select a queue to start reviewing.</p>
        </div>
        <div className="admin-stat-grid">
          <QueueCard icon={<ClipboardCheck size={18} />} label="Companion profiles" value={counts?.companionApplicationsPending} to="/companion-applications" />
          <QueueCard icon={<ShieldCheck size={18} />} label="Identity checks" value={counts?.memberVerificationsPending} to="/booking-verification" />
          <QueueCard icon={<Flag size={18} />} label="Safety reports" value={counts?.reportsOpen} to="/reports" />
          {overview?.viewerRole === 'admin' ? <QueueCard icon={<UsersRound size={18} />} label="Suspended users" value={counts?.usersSuspended} to="/users" /> : null}
        </div>
      </section>

      <section className="admin-activity-section" aria-labelledby="recent-activity-heading">
        <header className="admin-section-heading">
          <div>
            <p className="eyebrow">Accountability</p>
            <h2 className="text-h2" id="recent-activity-heading">Recent activity</h2>
          </div>
          {overview?.viewerRole === 'admin' ? <Link className="btn btn-ghost btn-sm" to="/audit-logs">View audit log <ArrowRight size={14} aria-hidden="true" /></Link> : null}
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

function QueueCard({ icon, label, value, to }: { icon: ReactNode; label: string; value: number | undefined; to: '/companion-applications' | '/booking-verification' | '/reports' | '/users' }) {
  return (
    <Link className="admin-stat admin-queue-card" to={to}>
      <span className="admin-stat-icon" aria-hidden="true">{icon}</span>
      <span className="admin-stat-copy">
        <span className="admin-stat-value">{value ?? '...'}</span>
        <span className="admin-stat-label">{label}</span>
      </span>
      <ArrowRight className="admin-stat-arrow" size={16} aria-hidden="true" />
    </Link>
  )
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
