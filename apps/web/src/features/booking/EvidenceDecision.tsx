import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '../../design-system/atoms/Button'
import { prepareEvidenceImage } from '../../lib/chatAttachments'

export type EvidenceDecisionState = 'loading' | 'decided' | 'undecided'

type EvidenceDecisionViewProps = {
  label: string
  guidance: string
  state: EvidenceDecisionState
  decision?: string
  busy?: boolean
  error?: string
  onUpload: (file: File) => void | Promise<void>
  onSkip: () => void | Promise<void>
}

export function EvidenceDecisionView({
  label,
  guidance,
  state,
  decision,
  busy = false,
  error,
  onUpload,
  onSkip,
}: EvidenceDecisionViewProps) {
  if (state === 'loading') {
    return (
      <div className="evidence-decision" data-state="loading" role="status">
        <p className="text-meta"><strong>{label}:</strong> Loading evidence status…</p>
      </div>
    )
  }

  if (state === 'decided') {
    return (
      <div className="evidence-decision" data-state="decided">
        <p className="text-meta">
          <strong>{label}:</strong> {decision === 'uploaded' ? 'Private image saved' : 'Skipped after warning acknowledgement'}.
        </p>
      </div>
    )
  }

  return (
    <div className="evidence-decision" data-state="undecided">
      <div><p className="text-h3">{label}</p><p className="text-meta mt-1">{guidance}</p></div>
      {error && <p className="text-meta text-[color:var(--danger)]">{error}</p>}
      <div className="flex gap-2 flex-wrap">
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
  )
}

type EvidenceDecisionProps = {
  bookingId: Id<'bookings'>
  label: string
  guidance: string
  skipWarning: string
}

export function EvidenceDecision({ bookingId, label, guidance, skipWarning }: EvidenceDecisionProps) {
  const evidence = useQuery(api.bookingEvidence.status, { bookingId })
  const uploadImage = useAction(api.bookingEvidence.uploadImage)
  const skip = useMutation(api.bookingEvidence.skip)
  const [busy, setBusy] = useState(false)
  const [evidenceError, setEvidenceError] = useState('')

  const state: EvidenceDecisionState = evidence === undefined
    ? 'loading'
    : evidence?.decision
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
      setEvidenceError(error instanceof Error ? error.message : 'Evidence image could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const handleSkip = async () => {
    if (!window.confirm(skipWarning)) return
    setBusy(true)
    setEvidenceError('')
    try {
      await skip({ bookingId, warningAcknowledged: true })
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : 'Evidence decision could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <EvidenceDecisionView
      label={label}
      guidance={guidance}
      state={state}
      decision={evidence?.decision ?? undefined}
      busy={busy}
      error={evidenceError}
      onUpload={handleUpload}
      onSkip={handleSkip}
    />
  )
}
