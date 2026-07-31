import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../web/convex/_generated/api'
import { ActionNote } from '../components/ActionNote'

type HostStatus = 'pending_review' | 'approved' | 'rejected' | 'suspended' | 'draft' | 'all'

export const Route = createFileRoute('/host-applications')({ component: HostApplicationsPage })

function HostApplicationsPage() {
  const [status, setStatus] = useState<HostStatus>('pending_review')
  const rows = useQuery(api.admin.hostApplications, { status })
  const reviewHost = useMutation(api.admin.reviewHostApplication)

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Safety review</p>
          <h1 className="text-h1 mt-2">Host applications</h1>
          <p className="lede mt-2">Review Strengths, categories, boundaries, and application notes. Identity is decided separately in the mandatory Persona queue.</p>
        </div>
      </header>

      <div className="admin-filter-row">
        <label className="field-row">
          <span className="label">Status</span>
          <select className="field" value={status} onChange={(event) => setStatus(event.currentTarget.value as HostStatus)}>
            <option value="pending_review">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
            <option value="draft">Draft</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      {rows === undefined ? (
        <div className="admin-empty">Loading host applications...</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty">No host applications match this filter.</div>
      ) : (
        <div className="panel">
          <div className="worklist">
            {rows.map((host) => (
              <article key={host._id} className="worklist-row">
                <div className="worklist-row-head">
                  <div>
                    <h2 className="text-h3">{host.applicantDisplayName}</h2>
                    <div className="worklist-row-meta">
                      <span>{host.city}</span>
                      <span className="dot" aria-hidden="true" />
                      <span>{formatMode(host.mode)}</span>
                      <span className="dot" aria-hidden="true" />
                      <span className="status-pill" data-tone={statusTone(host.status)}>{host.status}</span>
                      <span className="dot" aria-hidden="true" />
                      <span>Identity {host.applicantIdentityEligible ? 'approved' : 'not approved'}</span>
                      <span className="dot" aria-hidden="true" />
                      <span>Persona {formatStatus(host.verificationPersonaStatus ?? 'not started')}</span>
                    </div>
                  </div>
                  <div className="admin-action-stack">
                    <ActionNote
                      label="Approve"
                      submitLabel="Approve"
                      disabled={host.status !== 'pending_review' || !host.applicantIdentityEligible || host.applicantSuspended}
                      onSubmit={(note) => reviewHost({ hostProfileId: host._id, decision: 'approved', note })}
                    />
                    <ActionNote
                      label="Reject"
                      submitLabel="Reject"
                      tone="danger"
                      requireNote
                      disabled={host.status !== 'pending_review'}
                      onSubmit={(note) => reviewHost({ hostProfileId: host._id, decision: 'rejected', note })}
                    />
                  </div>
                </div>
                {host.applicantSuspended && <p className="text-meta">Approval remains disabled while this member account is suspended.</p>}
                {!host.applicantIdentityEligible && host.status === 'pending_review' && (
                  <p className="text-meta">Approval remains disabled until this member completes Persona verification and the identity reviewer explicitly approves it.</p>
                )}
                <p className="text-body muted max-w-[76ch]">{host.intro}</p>
                <div className="worklist-row-meta">
                  <span>Strengths: {host.strengths.join(', ') || 'none'}</span>
                </div>
                <div className="worklist-row-meta">
                  <span>Categories: {host.categories.join(', ') || 'none'}</span>
                </div>
                <div className="worklist-row-meta">
                  <span>Boundaries: {host.boundaries.join(', ') || 'none'}</span>
                </div>
                <div className="worklist-row-meta">
                  <span>Persona decision: {formatStatus(host.verificationPersonaDecision ?? 'unknown')}</span>
                  <span className="dot" aria-hidden="true" />
                  <span>Identity review: {formatStatus(host.verificationAdminStatus ?? 'not started')}</span>
                  {host.personaDashboardUrl && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <a href={host.personaDashboardUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Open in Persona</a>
                    </>
                  )}
                </div>
                {host.applicationNote && <p className="text-meta">Reviewer note from applicant: {host.applicationNote}</p>}
                {host.reviewerNote && <p className="text-meta">Last internal note: {host.reviewerNote}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | undefined {
  if (status === 'approved') return 'success'
  if (status === 'pending_review') return 'warning'
  if (status === 'rejected' || status === 'suspended') return 'danger'
  return undefined
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).replaceAll('_', ' ')
}

function formatMode(mode: string) {
  if (mode === 'both') return 'Online and in-person'
  if (mode === 'in_person') return 'In-person'
  return 'Online'
}
