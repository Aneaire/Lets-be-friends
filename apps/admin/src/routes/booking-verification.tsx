import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../web/convex/_generated/api'
import { ActionNote } from '../components/ActionNote'

type VerificationStatus = 'not_ready' | 'pending' | 'approved' | 'rejected' | 'all'

export const Route = createFileRoute('/booking-verification')({ component: BookingVerificationPage })

function BookingVerificationPage() {
  const [status, setStatus] = useState<VerificationStatus>('pending')
  const rows = useQuery(api.admin.memberVerifications, { status })
  const reviewMember = useMutation(api.admin.reviewMemberVerification)

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Safety review</p>
          <h1 className="text-h1 mt-2">Identity verification</h1>
          <p className="lede mt-2">Review every completed Persona identity before booking or Friend Host access becomes available.</p>
        </div>
      </header>

      <div className="admin-filter-row">
        <label className="field-row">
          <span className="label">Status</span>
          <select className="field" value={status} onChange={(event) => setStatus(event.currentTarget.value as VerificationStatus)}>
            <option value="pending">Awaiting admin review</option>
            <option value="not_ready">Persona incomplete</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      {rows === undefined ? (
        <div className="admin-empty">Loading identity verification...</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty">No identity verification requests match this filter.</div>
      ) : (
        <div className="panel">
          <div className="worklist">
            {rows.map((verification) => (
              <article key={verification._id} className="worklist-row">
                <div className="worklist-row-head">
                  <div>
                    <h2 className="text-h3">{verification.memberDisplayName}</h2>
                    <div className="worklist-row-meta">
                      <span>{verification.requestType}</span>
                      <span className="dot" aria-hidden="true" />
                      <span className="tabular">Attempt {verification.attempt ?? 1}</span>
                      <span className="dot" aria-hidden="true" />
                      <span className="tabular">Started {formatTime(verification.createdAt)}</span>
                      <span className="dot" aria-hidden="true" />
                      <span className="status-pill" data-tone={adminStatusTone(verification.adminStatus)}>{formatStatus(verification.adminStatus)}</span>
                    </div>
                  </div>
                  <div className="admin-action-stack">
                    <ActionNote
                      label="Approve"
                      submitLabel="Approve"
                      disabled={!verification.approvalAllowed}
                      onSubmit={(note) => reviewMember({ verificationRequestId: verification._id, decision: 'approved', note })}
                    />
                    <ActionNote
                      label="Reject"
                      submitLabel="Reject"
                      tone="danger"
                      requireNote
                      disabled={verification.adminStatus !== 'pending'}
                      onSubmit={(note) => reviewMember({ verificationRequestId: verification._id, decision: 'rejected', note })}
                    />
                  </div>
                </div>
                <div className="worklist-row-meta">
                  <span>Persona: {formatStatus(verification.personaStatus)}</span>
                  <span className="dot" aria-hidden="true" />
                  <span>Decision: {formatStatus(verification.personaDecision ?? 'unknown')}</span>
                  <span className="dot" aria-hidden="true" />
                  <span>Account: {formatStatus(verification.memberVerificationStatus)}</span>
                  {verification.providerCompletedAt && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <span className="tabular">Completed {formatTime(verification.providerCompletedAt)}</span>
                    </>
                  )}
                  {verification.personaDashboardUrl && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <a href={verification.personaDashboardUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Open in Persona</a>
                    </>
                  )}
                  {verification.bookingStatus && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <span>Legacy booking: {formatStatus(verification.bookingStatus)}</span>
                    </>
                  )}
                  {verification.bookingCategory && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <span>{verification.bookingCategory}</span>
                    </>
                  )}
                  {verification.bookingMode && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <span>{formatMode(verification.bookingMode)}</span>
                    </>
                  )}
                  {verification.hostDisplayName && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <span>{verification.hostDisplayName}</span>
                    </>
                  )}
                </div>
                {!verification.approvalAllowed && verification.adminStatus === 'pending' && (
                  <p className="text-meta">Approval is blocked because Persona did not return an approvable result. Review and reject this attempt, then the member can start a new one.</p>
                )}
                {verification.personaInquiryId && <p className="text-meta admin-code">Inquiry: {verification.personaInquiryId}</p>}
                {verification.reviewerNote && <p className="text-meta">Last internal note: {verification.reviewerNote}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function adminStatusTone(status: string): 'self' | 'success' | 'warning' | 'danger' {
  if (status === 'approved') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'rejected') return 'danger'
  return 'self'
}

function formatMode(mode: string) {
  return mode === 'in_person' ? 'In-person' : 'Online'
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).replaceAll('_', ' ')
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
