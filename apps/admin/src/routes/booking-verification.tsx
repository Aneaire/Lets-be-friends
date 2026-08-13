import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
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
          <p className="lede mt-2">Review every completed identity submission before booking or Companion access becomes available.</p>
        </div>
      </header>

      <div className="admin-filter-row">
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
                    <p className="text-meta">ID: {formatStatus(verification.identityRecord.idType ?? 'unknown')}{verification.identityRecord.idNumberLast4 ? ` ending ${verification.identityRecord.idNumberLast4}` : ''}</p>
                    <p className="text-meta">Expiration: {verification.identityRecord.expirationDate ?? 'Not provided'} · Nationality: {verification.identityRecord.nationality ?? 'Not provided'}</p>
                    {verification.identityRecord.extractionNeedsReview && <p className="text-meta">The AI marked one or more extracted fields for careful review.</p>}
                    {verification.adminStatus === 'pending' && <IdentityImageReview verificationRequestId={verification._id} />}
                  </div>
                )}
                {!verification.approvalAllowed && verification.adminStatus === 'pending' && (
                  <p className="text-meta">Approval is blocked because the provider did not return an approvable result. Review and reject this attempt, then the member can start a new one.</p>
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

function IdentityImageReview({ verificationRequestId }: { verificationRequestId: any }) {
  const readImage = useAction(api.identityRecords.readReviewImage)
  const [preview, setPreview] = useState<{ url: string; label: string; displayUntil: number } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')

  useEffect(() => {
    if (!preview) return
    const remaining = Math.max(0, preview.displayUntil - Date.now())
    const timer = window.setTimeout(() => setPreview(null), remaining)
    return () => {
      window.clearTimeout(timer)
      URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  const open = async (kind: 'id_front' | 'id_back' | 'selfie', label: string) => {
    setLoading(kind)
    setError('')
    try {
      const result = await readImage({ verificationRequestId, kind })
      const url = URL.createObjectURL(new Blob([result.bytes], { type: result.contentType }))
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url)
        return { url, label, displayUntil: result.displayUntil }
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The identity image could not be opened.')
    } finally {
      setLoading('')
    }
  }

  return <div className="mt-3">
    <div className="admin-filter-row">
      <button type="button" className="btn btn-neutral btn-sm" onClick={() => void open('id_front', 'ID front')} disabled={Boolean(loading)}>{loading === 'id_front' ? 'Opening...' : 'View ID front'}</button>
      <button type="button" className="btn btn-neutral btn-sm" onClick={() => void open('id_back', 'ID back')} disabled={Boolean(loading)}>{loading === 'id_back' ? 'Opening...' : 'View ID back'}</button>
      <button type="button" className="btn btn-neutral btn-sm" onClick={() => void open('selfie', 'Current selfie')} disabled={Boolean(loading)}>{loading === 'selfie' ? 'Opening...' : 'View current selfie'}</button>
    </div>
    {preview && <div className="mt-3"><p className="text-meta">{preview.label}. Access expires {formatTime(preview.displayUntil)}.</p><img src={preview.url} alt={preview.label} className="w-full" /></div>}
    {error && <p className="text-meta">{error}</p>}
  </div>
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
