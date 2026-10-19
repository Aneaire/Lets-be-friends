import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '../../design-system/atoms/Button'
import { prepareEvidenceImage } from '../../lib/chatAttachments';
import { describeConvexError } from '../../lib/convexErrors'

export type EvidenceRole = 'companion_start' | 'member_end'
export type EvidenceDecisionValue = 'uploaded' | 'skipped'
export type EvidenceDecisionState = 'loading' | 'decided' | 'undecided'

export type EvidenceRow = {
  role: EvidenceRole
  isViewer: boolean
  decision?: EvidenceDecisionValue
}

// The record is shared so either participant can read both halves of it, but
// only the safety team can ever open an image.
const SECTION_GUIDANCE = 'Optional and private. A reviewer or admin can open an image only while a linked booking report is active; every retrieval is audited. The other person sees that a decision was made, never the image.'

const viewerGuidance: Record<EvidenceRole, string> = {
  companion_start: 'Upload one private start image, or skip after reading the warning.',
  member_end: 'Upload one private end image, or skip after reading the warning.',
}

const skipWarning: Record<EvidenceRole, string> = {
  companion_start: 'Strict warning: skipping means no private start image will be available to help reviewers evaluate a later booking report. Skip anyway?',
  member_end: 'Strict warning: skipping means no private end image will be available to help reviewers evaluate a later booking report. Skip anyway?',
}

const ROW_LABELS: Record<EvidenceRole, { label: string; counterpart: string }> = {
  companion_start: { label: 'Start evidence', counterpart: 'The Companion' },
  member_end: { label: 'End evidence', counterpart: 'The member' },
}

export function evidenceSkipWarning(role: EvidenceRole) {
  return skipWarning[role]
}

function stateCopy(decision: EvidenceDecisionValue | undefined) {
  if (decision === 'uploaded') return 'Private image saved'
  if (decision === 'skipped') return 'Skipped after warning'
  return 'Not decided yet'
}

function roleOf(rows: EvidenceRow[]) {
  return rows.find((row) => row.isViewer)?.role
}

type EvidenceDecisionViewProps = {
  state: EvidenceDecisionState
  rows?: EvidenceRow[]
  busy?: boolean
  error?: string
  onUpload: (file: File) => void | Promise<void>
  onSkip: () => void | Promise<void>
}

export function EvidenceDecisionView({
  state,
  rows = [],
  busy = false,
  error,
  onUpload,
  onSkip,
}: EvidenceDecisionViewProps) {
  const viewerRole = roleOf(rows)

  return (
    <section className="evidence-decision" data-state={state} aria-label="Booking evidence">
      <div className="evidence-decision-head">
        <h3 className="evidence-decision-title">Evidence</h3>
        <p className="evidence-decision-guidance">{SECTION_GUIDANCE}</p>
      </div>

      {state === 'loading' ? (
        <p className="evidence-decision-loading text-meta" role="status">Loading evidence status…</p>
      ) : (
        <ul className="evidence-decision-rows">
          {rows.map((row) => (
            <li
              key={row.role}
              className="evidence-decision-row"
              data-own={row.isViewer ? 'true' : undefined}
            >
              <span className="evidence-decision-row-name">{ROW_LABELS[row.role].label}</span>
              <span className="evidence-decision-row-owner">
                {row.isViewer ? 'You' : ROW_LABELS[row.role].counterpart}
              </span>
              <span className="evidence-decision-row-state" data-decision={row.decision ?? 'pending'}>
                {stateCopy(row.decision)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {state === 'undecided' && viewerRole && (
        <div className="evidence-decision-controls">
          <p className="evidence-decision-guidance">{viewerGuidance[viewerRole]}</p>
          {error && <p className="evidence-decision-error" role="alert">{error}</p>}
          <div className="evidence-decision-buttons">
            <label className={`btn btn-social-quiet btn-sm ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              {busy ? 'Processing image…' : 'Upload private image'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ''
                  if (file) void onUpload(file)
                }}
              />
            </label>
            <Button
              size="small"
              intent="danger"
              disabled={busy}
              onClick={() => void onSkip()}
            >
              Skip after warning
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

type EvidenceDecisionProps = {
  bookingId: Id<'bookings'>
}

export function EvidenceDecision({ bookingId }: EvidenceDecisionProps) {
  const evidence = useQuery(api.bookingEvidence.status, { bookingId })
  const uploadImage = useAction(api.bookingEvidence.uploadImage)
  const skip = useMutation(api.bookingEvidence.skip)
  const [busy, setBusy] = useState(false)
  const [evidenceError, setEvidenceError] = useState('')

  // `rows` arrives with the query that reports both roles. Until that query is
  // deployed, fall back to the viewer's own decision so an older backend cannot
  // make a decided booking look undecided.
  const rows: EvidenceRow[] = evidence?.rows?.length
    ? evidence.rows
    : evidence
      ? [{ role: evidence.role, isViewer: true, decision: evidence.decision }]
      : []
  const state: EvidenceDecisionState = evidence === undefined
    ? 'loading'
    : rows.find((row) => row.isViewer)?.decision
      ? 'decided'
      : 'undecided'

  const handleUpload = async (file: File) => {
    setBusy(true)
    setEvidenceError('')
    try {
      const processed = await prepareEvidenceImage(file)
      await uploadImage({
        bookingId,
        bytes: await processed.arrayBuffer(),
        contentType: processed.type,
      })
    } catch (error) {
      setEvidenceError(error instanceof Error ? describeConvexError(error) : 'Evidence image could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const handleSkip = async () => {
    const viewerRole = roleOf(rows)
    if (!viewerRole || !window.confirm(evidenceSkipWarning(viewerRole))) return
    setBusy(true)
    setEvidenceError('')
    try {
      await skip({ bookingId, warningAcknowledged: true })
    } catch (error) {
      setEvidenceError(error instanceof Error ? describeConvexError(error) : 'Evidence decision could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <EvidenceDecisionView
      state={state}
      rows={rows}
      busy={busy}
      error={evidenceError}
      onUpload={handleUpload}
      onSkip={handleSkip}
    />
  )
}
