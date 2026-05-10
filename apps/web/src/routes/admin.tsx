import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import type React from 'react'
import { api } from '../../convex/_generated/api'
import { WorkspaceShell } from '../components/AppShell'

export const Route = createFileRoute('/admin')({ component: AdminPage })

type Tab = 'hosts' | 'verifications' | 'reports' | 'audit'

function AdminPage() {
  const queues = useQuery(api.admin.queues)
  const reviewHost = useMutation(api.admin.reviewHostApplication)
  const reviewBooking = useMutation(api.admin.reviewBookingVerification)
  const resolveReport = useMutation(api.admin.resolveReport)
  const [tab, setTab] = useState<Tab>('hosts')
  const [notice, setNotice] = useState('')

  if (queues === undefined) {
    return (
      <main className="marketing-page">
        <p className="eyebrow">Admin</p>
        <h1 className="text-h1 mt-2">Loading review queues…</h1>
        <p className="lede mt-2">A reviewer or owner role is required for this surface.</p>
      </main>
    )
  }

  const counts = {
    hosts: queues.hostApplications.length,
    verifications: queues.bookingVerifications.length,
    reports: queues.reports.length,
    audit: queues.auditLogs.length,
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'hosts', label: 'Host applications', count: counts.hosts },
    { id: 'verifications', label: 'Verifications', count: counts.verifications },
    { id: 'reports', label: 'Reports', count: counts.reports },
    { id: 'audit', label: 'Audit log', count: counts.audit },
  ]

  return (
    <WorkspaceShell
      eyebrow="Trust & safety"
      title="Admin review"
      description="Operational queue: host applications, identity holds, reports, and the audit trail."
      rail={
        <>
          <div className="rail-section">
            <div className="rail-section-title">Queues</div>
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`rail-link${tab === entry.id ? ' is-active' : ''}`}
                onClick={() => setTab(entry.id)}
                aria-current={tab === entry.id ? 'page' : undefined}
              >
                <span>{entry.label}</span>
                <span className="rail-link-count tabular">{entry.count}</span>
              </button>
            ))}
          </div>
          <div className="rail-section">
            <div className="rail-section-title">Posture</div>
            <div className="rail-link" aria-disabled="true" style={{ cursor: 'default' }}>
              <span>Open work</span>
              <span className="status-pill" data-tone={counts.hosts + counts.verifications + counts.reports > 0 ? 'warning' : 'success'}>
                {counts.hosts + counts.verifications + counts.reports}
              </span>
            </div>
          </div>
        </>
      }
    >
      {notice && (
        <div className="notice notice-success mb-6">
          <span className="notice-icon">✓</span>
          <span>{notice}</span>
        </div>
      )}

      {tab === 'hosts' && (
        <Queue
          title="Host applications"
          subtitle="Review identity, intro, and category fit. Approval makes the host visible in discovery."
          empty="Queue is empty."
        >
          {queues.hostApplications.map((host) => (
            <article key={host._id} className="worklist-row">
              <div className="worklist-row-head">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="avatar avatar-lg" aria-hidden="true">{initials(host.displayName)}</span>
                  <div className="min-w-0">
                    <h3 className="text-h3">{host.displayName}</h3>
                    <div className="worklist-row-meta">
                      <span>{host.city}</span>
                      <span className="dot" aria-hidden="true" />
                      <span>{formatMode(host.mode)}</span>
                      <span className="dot" aria-hidden="true" />
                      <span className="status-pill" data-tone="warning">{host.status}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={async () => {
                      await reviewHost({ hostProfileId: host._id, decision: 'approved', note: 'Approved in MVP admin scaffold.' })
                      setNotice(`${host.displayName} approved.`)
                    }}
                    className="btn btn-neutral btn-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      await reviewHost({ hostProfileId: host._id, decision: 'rejected', note: 'Rejected in MVP admin scaffold.' })
                      setNotice(`${host.displayName} rejected.`)
                    }}
                    className="btn btn-danger btn-sm"
                  >
                    Reject
                  </button>
                </div>
              </div>
              <p className="text-body muted max-w-[72ch]">{host.intro}</p>
              {host.applicationNote && (
                <p className="text-meta">
                  <span className="text-soft">Reviewer note · </span>{host.applicationNote}
                </p>
              )}
            </article>
          ))}
        </Queue>
      )}

      {tab === 'verifications' && (
        <Queue
          title="Booking verifications"
          subtitle="Identity holds blocking a booking. Approving releases the booking request to the host."
          empty="No identity holds open."
        >
          {queues.bookingVerifications.map((verification) => (
            <article key={verification._id} className="worklist-row">
              <div className="worklist-row-head">
                <div className="min-w-0">
                  <h3 className="text-h3">{verification.reason}</h3>
                  <div className="worklist-row-meta">
                    <span>Persona: {verification.personaInquiryId ?? 'none'}</span>
                    <span className="dot" aria-hidden="true" />
                    <span className="status-pill" data-tone="warning">{verification.personaStatus}</span>
                    <span className="dot" aria-hidden="true" />
                    <span className="text-tiny tabular">booking {String(verification.bookingId ?? '·').slice(-8)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={async () => {
                      await reviewBooking({ verificationRequestId: verification._id, decision: 'approved', note: 'Approved in MVP admin scaffold.' })
                      setNotice('Verification approved. Booking moved to request_sent.')
                    }}
                    className="btn btn-neutral btn-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      await reviewBooking({ verificationRequestId: verification._id, decision: 'rejected', note: 'Rejected in MVP admin scaffold.' })
                      setNotice('Verification rejected.')
                    }}
                    className="btn btn-danger btn-sm"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </article>
          ))}
        </Queue>
      )}

      {tab === 'reports' && (
        <Queue
          title="Open reports"
          subtitle="User-submitted concerns about profiles, posts, messages, bookings, or reviews."
          empty="No open reports."
        >
          {queues.reports.map((report) => (
            <article key={report._id} className="worklist-row">
              <div className="worklist-row-head">
                <div className="min-w-0">
                  <h3 className="text-h3">{titleCase(report.targetType)}</h3>
                  <div className="worklist-row-meta">
                    <span className="status-pill" data-tone="danger">{report.status}</span>
                    <span className="dot" aria-hidden="true" />
                    <span className="text-tiny tabular">{String(report.targetId).slice(-10)}</span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await resolveReport({ reportId: report._id, status: 'resolved', note: 'Resolved in MVP admin scaffold.' })
                    setNotice('Report resolved.')
                  }}
                  className="btn btn-neutral btn-sm"
                >
                  Resolve
                </button>
              </div>
              <p className="text-body muted max-w-[72ch]">{report.reason}</p>
            </article>
          ))}
        </Queue>
      )}

      {tab === 'audit' && (
        <Queue
          title="Recent audit"
          subtitle="Last 20 actions taken across review surfaces."
          empty="Nothing logged yet."
        >
          {queues.auditLogs.map((log) => (
            <article key={log._id} className="worklist-row">
              <div className="worklist-row-head">
                <div className="min-w-0">
                  <h3 className="text-h3">{log.action}</h3>
                  <div className="worklist-row-meta">
                    <span>{log.targetType}</span>
                    {log.targetId && (
                      <>
                        <span className="dot" aria-hidden="true" />
                        <span className="text-tiny tabular">{String(log.targetId).slice(-10)}</span>
                      </>
                    )}
                    <span className="dot" aria-hidden="true" />
                    <span className="text-tiny tabular">{formatRelative(log._creationTime)}</span>
                  </div>
                </div>
              </div>
              {log.note && <p className="text-meta">{log.note}</p>}
            </article>
          ))}
        </Queue>
      )}
    </WorkspaceShell>
  )
}

function Queue({
  title,
  subtitle,
  empty,
  children,
}: {
  title: string
  subtitle: string
  empty: string
  children: React.ReactNode
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <section>
      <header className="mb-4">
        <h2 className="text-h2">{title}</h2>
        <p className="text-meta mt-1 max-w-[68ch]">{subtitle}</p>
      </header>
      {hasChildren ? (
        <div className="panel">
          <div className="worklist">{children}</div>
        </div>
      ) : (
        <div className="empty-state">
          <p className="empty-state-title">{empty}</p>
        </div>
      )}
    </section>
  )
}

function formatMode(mode: string) {
  if (mode === 'both') return 'Online and in-person'
  if (mode === 'in_person') return 'In-person'
  return 'Online'
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatRelative(timestamp: number) {
  const diff = Date.now() - timestamp
  const seconds = Math.round(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}
