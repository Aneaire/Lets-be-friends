import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../web/convex/_generated/api'
import { ActionNote } from '../components/ActionNote'

type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'not_started' | 'all'

export const Route = createFileRoute('/booking-verification')({ component: BookingVerificationPage })

function BookingVerificationPage() {
  const [status, setStatus] = useState<VerificationStatus>('pending')
  const rows = useQuery(api.admin.bookingVerifications, { status })
  const reviewBooking = useMutation(api.admin.reviewBookingVerification)

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Safety review</p>
          <h1 className="text-h1 mt-2">Booking verification</h1>
          <p className="lede mt-2">Resolve identity holds before a booking request reaches the Friend Host.</p>
        </div>
      </header>

      <div className="admin-filter-row">
        <label className="field-row">
          <span className="label">Status</span>
          <select className="field" value={status} onChange={(event) => setStatus(event.currentTarget.value as VerificationStatus)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="not_started">Not started</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      {rows === undefined ? (
        <div className="admin-empty">Loading booking verification...</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty">No booking verification requests match this filter.</div>
      ) : (
        <div className="panel">
          <div className="worklist">
            {rows.map((verification) => (
              <article key={verification._id} className="worklist-row">
                <div className="worklist-row-head">
                  <div>
                    <h2 className="text-h3">{verification.memberDisplayName}</h2>
                    <div className="worklist-row-meta">
                      <span>{verification.bookingCategory ?? 'Booking'}</span>
                      {verification.bookingMode && (
                        <>
                          <span className="dot" aria-hidden="true" />
                          <span>{formatMode(verification.bookingMode)}</span>
                        </>
                      )}
                      <span className="dot" aria-hidden="true" />
                      <span>{verification.hostDisplayName}</span>
                      <span className="dot" aria-hidden="true" />
                      <span className="status-pill" data-tone={verification.adminStatus === 'pending' ? 'warning' : verification.adminStatus === 'rejected' ? 'danger' : 'success'}>{verification.adminStatus}</span>
                    </div>
                  </div>
                  <div className="admin-action-stack">
                    <ActionNote
                      label="Approve"
                      submitLabel="Approve"
                      disabled={verification.adminStatus === 'approved'}
                      onSubmit={(note) => reviewBooking({ verificationRequestId: verification._id, decision: 'approved', note })}
                    />
                    <ActionNote
                      label="Reject"
                      submitLabel="Reject"
                      tone="danger"
                      requireNote
                      disabled={verification.adminStatus === 'rejected'}
                      onSubmit={(note) => reviewBooking({ verificationRequestId: verification._id, decision: 'rejected', note })}
                    />
                  </div>
                </div>
                <div className="worklist-row-meta">
                  <span>Persona: {verification.personaInquiryId ?? 'none'}</span>
                  <span className="dot" aria-hidden="true" />
                  <span>Persona status: {verification.personaStatus}</span>
                  {verification.bookingStatus && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <span>Booking: {verification.bookingStatus}</span>
                    </>
                  )}
                  {verification.requestedAt && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <span className="tabular">{formatTime(verification.requestedAt)}</span>
                    </>
                  )}
                </div>
                {verification.reviewerNote && <p className="text-meta">Last internal note: {verification.reviewerNote}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function formatMode(mode: string) {
  return mode === 'in_person' ? 'In-person' : 'Online'
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
