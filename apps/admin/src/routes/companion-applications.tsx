import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../web/convex/_generated/api'
import { ActionNote } from '../design-system/molecules/ActionNote'

type CompanionStatus = 'pending_review' | 'approved' | 'rejected' | 'suspended' | 'draft' | 'all'

export const Route = createFileRoute('/companion-applications')({ component: CompanionApplicationsPage })

function CompanionApplicationsPage() {
  const [status, setStatus] = useState<CompanionStatus>('pending_review')
  const rows = useQuery(api.admin.companionApplications, { status })
  const reviewCompanion = useMutation(api.admin.reviewCompanionApplication)

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Safety review</p>
          <h1 className="text-h1 mt-2">Companion profile reviews</h1>
          <p className="lede mt-2">Review Strengths, activities, boundaries, and profile notes. Identity is decided separately in the identity review queue.</p>
        </div>
      </header>

      <div className="admin-filter-row">
        <label className="field-row">
          <span className="label">Status</span>
          <select className="field" value={status} onChange={(event) => setStatus(event.currentTarget.value as CompanionStatus)}>
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
        <div className="admin-empty">Loading Companion profile reviews...</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty">No Companion profiles match this filter.</div>
      ) : (
        <div className="panel">
          <div className="worklist">
            {rows.map((companion) => (
              <article key={companion._id} className="worklist-row">
                <div className="worklist-row-head">
                  <div>
                    <h2 className="text-h3">{companion.applicantDisplayName}</h2>
                    <div className="worklist-row-meta">
                      <span>{companion.city}</span>
                      <span className="dot" aria-hidden="true" />
                      <span>{formatMode(companion.mode)}</span>
                      <span className="dot" aria-hidden="true" />
                      <span className="status-pill" data-tone={statusTone(companion.status)}>{companion.status}</span>
                      <span className="dot" aria-hidden="true" />
                      <span>Identity {companion.applicantIdentityEligible ? 'approved' : 'not approved'}</span>
                      <span className="dot" aria-hidden="true" />
                      <span>{companion.verificationSource === 'in_app' ? 'In-app identity' : `Identity provider ${formatStatus(companion.verificationPersonaStatus ?? 'not started')}`}</span>
                    </div>
                  </div>
                  <div className="admin-action-stack">
                    <ActionNote
                      label="Approve"
                      submitLabel="Approve"
                      disabled={companion.status !== 'pending_review' || !companion.applicantIdentityEligible || companion.applicantSuspended}
                      onSubmit={(note) => reviewCompanion({ companionProfileId: companion._id, decision: 'approved', note })}
                    />
                    <ActionNote
                      label="Reject"
                      submitLabel="Reject"
                      tone="danger"
                      requireNote
                      disabled={companion.status !== 'pending_review'}
                      onSubmit={(note) => reviewCompanion({ companionProfileId: companion._id, decision: 'rejected', note })}
                    />
                  </div>
                </div>
                {companion.applicantSuspended && <p className="text-meta">Approval remains disabled while this member account is suspended.</p>}
                {!companion.applicantIdentityEligible && companion.status === 'pending_review' && (
                  <p className="text-meta">Approval remains disabled until this member completes identity verification and the identity reviewer explicitly approves it.</p>
                )}
                <p className="text-body muted max-w-[76ch]">{companion.intro}</p>
                <div className="worklist-row-meta">
                  <span>Strengths: {companion.strengths.join(', ') || 'none'}</span>
                </div>
                <div className="worklist-row-meta">
                  <span>Categories: {companion.categories.join(', ') || 'none'}</span>
                </div>
                <div className="worklist-row-meta">
                  <span>Boundaries: {companion.boundaries.join(', ') || 'none'}</span>
                </div>
                <div className="worklist-row-meta">
                  <span>Provider decision: {formatStatus(companion.verificationPersonaDecision ?? 'unknown')}</span>
                  <span className="dot" aria-hidden="true" />
                  <span>Identity review: {formatStatus(companion.verificationAdminStatus ?? 'not started')}</span>
                </div>
                {companion.applicationNote && <p className="text-meta">Note from member: {companion.applicationNote}</p>}
                {companion.reviewerNote && <p className="text-meta">Last internal note: {companion.reviewerNote}</p>}
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
