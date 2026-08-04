import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../web/convex/_generated/api'
import { ActionNote } from '../components/ActionNote'

type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed' | 'all'
type TargetType = 'all' | 'profile' | 'booking' | 'message' | 'review' | 'post' | 'comment' | 'user'

export const Route = createFileRoute('/reports')({ component: ReportsPage })

function ReportsPage() {
  const [status, setStatus] = useState<ReportStatus>('open')
  const [targetType, setTargetType] = useState<TargetType>('all')
  const [evidenceError, setEvidenceError] = useState<{ reportId: string; message: string } | null>(null)
  const rows = useQuery(api.admin.reports, { status, targetType })
  const updateReport = useMutation(api.admin.updateReportStatus)
  const resolveBlockedFunds = useMutation(api.admin.resolveBlockedBookingFunds)
  const readAdminEvidence = useAction(api.bookingEvidence.readAdminEvidence)

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Moderation</p>
          <h1 className="text-h1 mt-2">Reports</h1>
          <p className="lede mt-2">Triage member-submitted concerns about profiles, bookings, messages, reviews, posts, comments, and users.</p>
        </div>
      </header>

      <div className="admin-filter-row">
        <label className="field-row">
          <span className="label">Status</span>
          <select className="field" value={status} onChange={(event) => setStatus(event.currentTarget.value as ReportStatus)}>
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="field-row">
          <span className="label">Target</span>
          <select className="field" value={targetType} onChange={(event) => setTargetType(event.currentTarget.value as TargetType)}>
            <option value="all">All targets</option>
            <option value="profile">Profiles</option>
            <option value="booking">Bookings</option>
            <option value="message">Messages</option>
            <option value="review">Reviews</option>
            <option value="post">Posts</option>
            <option value="comment">Comments</option>
            <option value="user">Users</option>
          </select>
        </label>
      </div>

      {rows === undefined ? (
        <div className="admin-empty">Loading reports...</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty">No reports match this filter.</div>
      ) : (
        <div className="panel">
          <div className="worklist">
            {rows.map((report) => (
              <article key={report._id} className="worklist-row">
                <div className="worklist-row-head">
                  <div>
                    <h2 className="text-h3">{report.targetSummary}</h2>
                    <div className="worklist-row-meta">
                      <span>Reporter: {report.reporterDisplayName}</span>
                      <span className="dot" aria-hidden="true" />
                      <span>{report.targetType}</span>
                      <span className="dot" aria-hidden="true" />
                      <span className="status-pill" data-tone={report.status === 'open' || report.status === 'reviewing' ? 'warning' : report.status === 'dismissed' ? 'danger' : 'success'}>{report.status}</span>
                      <span className="dot" aria-hidden="true" />
                      <span className="admin-code">{report.targetId}</span>
                    </div>
                  </div>
                  <div className="admin-action-stack">
                    <ActionNote
                      label="Mark reviewing"
                      submitLabel="Mark reviewing"
                      disabled={report.status === 'reviewing'}
                      onSubmit={(note) => updateReport({ reportId: report._id, status: 'reviewing', note })}
                    />
                    <ActionNote
                      label="Resolve"
                      submitLabel="Resolve"
                      disabled={report.status === 'resolved'}
                      onSubmit={(note) => updateReport({ reportId: report._id, status: 'resolved', note })}
                    />
                    <ActionNote
                      label="Dismiss"
                      submitLabel="Dismiss"
                      tone="danger"
                      requireNote
                      disabled={report.status === 'dismissed'}
                      onSubmit={(note) => updateReport({ reportId: report._id, status: 'dismissed', note })}
                    />
                  </div>
                </div>
                <p className="text-body muted max-w-[76ch]">{report.reason}</p>
                {report.bookingId && (
                  <div className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-meta">
                        Settlement: <strong>{report.bookingSettlementState?.replaceAll('_', ' ') ?? 'legacy / not applicable'}</strong>
                        {report.bookingSettlementEligibleAt ? ` · eligible ${new Date(report.bookingSettlementEligibleAt).toLocaleString()}` : ''}
                      </p>
                      {report.canResolveBlockedFunds && (
                        <div className="admin-action-stack">
                          <ActionNote
                            label="Release to host/platform"
                            submitLabel="Release blocked funds"
                            requireNote
                            onSubmit={(note) => resolveBlockedFunds({ bookingId: report.bookingId!, resolution: 'release_to_host', note: note! })}
                          />
                          <ActionNote
                            label="Return to member"
                            submitLabel="Return blocked funds"
                            tone="danger"
                            requireNote
                            onSubmit={(note) => resolveBlockedFunds({ bookingId: report.bookingId!, resolution: 'return_to_member', note: note! })}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-meta">Private evidence decisions · each retrieval requires an active report and is audited</p>
                      {report.evidence.length === 0 ? (
                        <p className="text-tiny mt-1">No evidence decision recorded. Evidence is not required to submit or validate this report.</p>
                      ) : (
                        <div className="flex gap-2 flex-wrap mt-2">
                          {report.evidence.map((evidence) => evidence.decision === 'uploaded' ? (
                            <button
                              key={evidence.role}
                              type="button"
                              className="btn btn-neutral btn-sm"
                              disabled={report.status !== 'open' && report.status !== 'reviewing'}
                              onClick={async () => {
                                setEvidenceError(null)
                                try {
                                  const access = await readAdminEvidence({ reportId: report._id, role: evidence.role })
                                  const objectUrl = URL.createObjectURL(new Blob([access.bytes], { type: access.contentType }))
                                  const evidenceWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer')
                                  if (!evidenceWindow) {
                                    URL.revokeObjectURL(objectUrl)
                                    throw new Error('Allow pop-ups to view this evidence image.')
                                  }
                                  window.setTimeout(
                                    () => URL.revokeObjectURL(objectUrl),
                                    Math.max(1_000, access.displayUntil - Date.now()),
                                  )
                                } catch (error) {
                                  setEvidenceError({
                                    reportId: String(report._id),
                                    message: error instanceof Error ? error.message : 'Evidence access failed.',
                                  })
                                }
                              }}
                            >
                              View {evidence.role === 'host_start' ? 'host start' : 'member end'} image
                            </button>
                          ) : (
                            <span key={evidence.role} className="status-pill" data-tone="warning">
                              {evidence.role === 'host_start' ? 'Host start' : 'Member end'} skipped
                            </span>
                          ))}
                        </div>
                      )}
                      {evidenceError?.reportId === String(report._id) && (
                        <p className="text-tiny action-note-error mt-2">{evidenceError.message}</p>
                      )}
                    </div>
                  </div>
                )}
                {report.reviewerNote && <p className="text-meta">Last internal note: {report.reviewerNote}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
