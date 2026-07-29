import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../web/convex/_generated/api'
import { ActionNote } from '../components/ActionNote'

type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed' | 'all'
type TargetType = 'all' | 'profile' | 'booking' | 'message' | 'review' | 'post' | 'comment' | 'user'

export const Route = createFileRoute('/reports')({ component: ReportsPage })

function ReportsPage() {
  const [status, setStatus] = useState<ReportStatus>('open')
  const [targetType, setTargetType] = useState<TargetType>('all')
  const rows = useQuery(api.admin.reports, { status, targetType })
  const updateReport = useMutation(api.admin.updateReportStatus)

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
                {report.reviewerNote && <p className="text-meta">Last internal note: {report.reviewerNote}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
