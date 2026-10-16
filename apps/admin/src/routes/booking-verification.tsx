import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../web/convex/_generated/api'
import type { IdentityAssessmentSignals } from '../../../web/convex/identityVerification'
import { identityRejectionReasons, isIdentityRejectionReason } from '../../../web/convex/identityVerification'
import { identitySignalLines } from '../lib/identitySignals'
import { ActionNote } from '../design-system/molecules/ActionNote'
import { AdminWorklistPagePresentation } from '../design-system/templates/AdminWorklistPagePresentation'
import { IdentityImagePanel } from '../features/identity/IdentityImagePanel'

type VerificationStatus = 'not_ready' | 'pending' | 'approved' | 'rejected' | 'all'

export const Route = createFileRoute('/booking-verification')({ component: BookingVerificationPage })

function BookingVerificationPage() {
  const [status, setStatus] = useState<VerificationStatus>('pending')
  const rows = useQuery(api.admin.memberVerifications, { status })
  const reviewMember = useMutation(api.admin.reviewMemberVerification)

  return (
    <AdminWorklistPagePresentation
      eyebrow="Safety review"
      title="Identity verification"
      description="Review every completed identity submission before booking or Companion access becomes available."
      filterControls={(
        <label className="field-row">
          <span className="label">Status</span>
          <select className="field" value={status} onChange={(event) => setStatus(event.currentTarget.value as VerificationStatus)}>
            <option value="pending">Awaiting admin review</option>
            <option value="not_ready">Identity check incomplete</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </label>
      )}
      rows={rows}
      getKey={(verification) => verification._id}
      loading="Loading identity verification..."
      empty="No identity verification requests match this filter."
      ariaLabel="Identity verification requests"
      getDialogTitle={(verification) => verification.memberDisplayName}
      getDialogDescription={(verification) => `${formatStatus(verification.requestType)} · Started ${formatTime(verification.createdAt)}`}
      renderSummary={(verification) => (
        <>
          <span className="text-h3 admin-worklist-title">{verification.memberDisplayName}</span>
          <span className="worklist-row-meta">
            <span>{formatStatus(verification.requestType)}</span>
            <span className="dot" aria-hidden="true" />
            <span className="tabular">Attempt {verification.attempt ?? 1}</span>
            <span className="dot" aria-hidden="true" />
            <span className="tabular">Started {formatTime(verification.createdAt)}</span>
            <span className="dot" aria-hidden="true" />
            <span className="status-pill" data-tone={adminStatusTone(verification.adminStatus)}>{formatStatus(verification.adminStatus)}</span>
          </span>
        </>
      )}
      renderDialogActions={(verification) => (
        <>
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
            disabled={!verification.reviewAllowed}
            choice={{
              label: 'Reason the member will see',
              placeholder: 'Choose a reason',
              options: identityRejectionReasons.map((reason) => ({ value: reason.code, label: reason.label })),
            }}
            onSubmit={(note, memberReason) => reviewMember({
              verificationRequestId: verification._id,
              decision: 'rejected',
              note,
              memberReason: isIdentityRejectionReason(memberReason) ? memberReason : undefined,
            })}
          />
        </>
      )}
      renderDetails={(verification) => (
        <>
          <div className="worklist-row-meta">
            <span>Source: {verification.verificationSource === 'in_app' ? 'In-app identity' : 'Persona'}</span>
            {verification.verificationSource !== 'in_app' && <><span className="dot" aria-hidden="true" /><span>Provider: {formatStatus(verification.personaStatus)}</span></>}
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
            {verification.companionDisplayName && (
              <>
                <span className="dot" aria-hidden="true" />
                <span>{verification.companionDisplayName}</span>
              </>
            )}
          </div>
          {verification.identityRecord && (
            <div className="panel mt-3">
              <p className="text-meta">Confirmed name: {verification.identityRecord.fullLegalName ?? 'Not provided'}</p>
              <p className="text-meta">Date of birth: {verification.identityRecord.dateOfBirth ?? 'Not provided'}</p>
              <p className="text-meta">ID: {formatStatus(verification.identityRecord.idType ?? 'unknown')}</p>
              <p className="text-meta">Expiration: {verification.identityRecord.expirationDate ?? 'Not provided'} · Nationality: {verification.identityRecord.nationality ?? 'Not provided'}</p>
              {verification.identityRecord.extractionNeedsReview && <p className="text-meta">The AI marked one or more extracted fields for careful review.</p>}
              {verification.identityRecord.assessment && <IdentitySignalSummary assessment={verification.identityRecord.assessment} />}
              {verification.identityRecord.assessmentFlagged && <p className="text-meta">One or more image signals fall below the review threshold. Compare the document against the confirmed details before approving.</p>}
              {verification.identityRecord.assessmentFailureCode && <p className="text-meta">Image signals were not captured for this attempt ({formatStatus(verification.identityRecord.assessmentFailureCode)}).</p>}
              {verification.adminStatus === 'pending' && <IdentityImagePanel verificationRequestId={verification._id} imageKinds={verification.identityRecord.imageKinds} />}
            </div>
          )}
          {!verification.reviewAllowed && verification.adminStatus === 'pending' && (
            <p className="text-meta">This historical provider attempt is read-only. The member must start a new in-app identity check.</p>
          )}
          {verification.reviewAllowed && !verification.approvalAllowed && (
            <p className="text-meta">Approval is blocked because required identity details are incomplete. Review and reject this attempt, then the member can start a new one.</p>
          )}
          {verification.personaInquiryId && <p className="text-meta admin-code">Inquiry: {verification.personaInquiryId}</p>}
          {verification.reviewerNote && <p className="text-meta">Last internal note: {verification.reviewerNote}</p>}
        </>
      )}
    />
  )
}

// The summary lines are built by a pure function so the probability formatting
// stays testable without rendering the admin route.
function IdentitySignalSummary({ assessment }: { assessment: IdentityAssessmentSignals }) {
  return <>{identitySignalLines(assessment).map((line) => <p key={line} className="text-meta">{line}</p>)}</>
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
