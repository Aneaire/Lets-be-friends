import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { CalendarHeart, Check, Clock, MapPin, Shield, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Avatar } from '../../design-system/atoms/Avatar'
import { ConfirmationDialog } from '../../design-system/molecules/Dialog'
import { formatGatheringDuration, formatGatheringWhen, gatheringModeLabel, gatheringParticipantStateLabel, gatheringSeatLabel, gatheringStateLabel } from './gatheringPresentation'

type GatheringDetail = NonNullable<ReturnType<typeof useQuery<typeof api.gatherings.get>>>
type Participant = GatheringDetail['participants'][number]

function ParticipantRow({ participant, canConfirm, busy, onDecide }: {
  participant: Participant
  canConfirm: boolean
  busy: boolean
  onDecide: (decision: 'confirmed' | 'declined' | 'removed') => void
}) {
  return (
    <article className="gathering-participant">
      <Avatar name={participant.displayName} src={participant.profileImageUrl} size="small" />
      <div>
        <strong>{participant.displayName}</strong>
        <span className="status-pill" data-tone={participant.state === 'confirmed' ? 'social' : undefined}>{gatheringParticipantStateLabel(participant.state)}</span>
      </div>
      {canConfirm && participant.state !== 'confirmed' && (
        <div className="gathering-participant-actions">
          <button type="button" className="btn btn-neutral btn-sm" disabled={busy} onClick={() => onDecide('confirmed')}><Check size={14} aria-hidden="true" /> Confirm</button>
          <button type="button" className="btn btn-danger-quiet btn-sm" disabled={busy} onClick={() => onDecide('declined')}>Decline</button>
        </div>
      )}
      {canConfirm && participant.state === 'confirmed' && (
        <div className="gathering-participant-actions">
          <button type="button" className="btn btn-danger-quiet btn-sm" disabled={busy} onClick={() => onDecide('removed')}>Remove</button>
        </div>
      )}
    </article>
  )
}

export function GatheringWorkspacePage({ gatheringId }: { gatheringId: string }) {
  const id = gatheringId as Id<'gatherings'>
  const detail = useQuery(api.gatherings.get, { gatheringId: id })
  const requestJoin = useMutation(api.gatherings.requestJoin)
  const leave = useMutation(api.gatherings.leave)
  const decideParticipant = useMutation(api.gatherings.decideParticipant)
  const cancelGathering = useMutation(api.gatherings.cancel)
  const postInvite = useMutation(api.gatherings.postInvite)
  const report = useMutation(api.reports.create)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [inviteBody, setInviteBody] = useState('')
  const [audience, setAudience] = useState('profile')

  async function run(label: string, callback: () => Promise<unknown>, success: string) {
    setBusy(label)
    setError('')
    try {
      await callback()
      if (success) toast.success(success)
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Gathering action could not be completed.')
      return false
    } finally {
      setBusy('')
    }
  }

  const requestingCount = detail?.requestedCount ?? 0
  const inviteAudienceOptions = useMemo(() => {
    if (!detail) return []
    return [
      { value: 'none', label: 'Do not post an Invite' },
      { value: 'profile', label: 'My profile' },
      ...(detail.circleId ? [{ value: detail.circleId, label: 'This Circle' }] : []),
    ]
  }, [detail])

  if (detail === undefined) {
    return <main className="gathering-workspace"><div className="circle-state-card" role="status"><strong>Loading Gathering...</strong></div></main>
  }

  const { viewer, participants } = detail
  const cancelled = detail.state === 'cancelled'
  const statusCopy = viewer.isHost
    ? 'You are hosting this Gathering.'
    : viewer.isCompanion
      ? 'You are the Companion for this Gathering.'
      : viewer.participantState === 'confirmed'
        ? 'Your seat is confirmed.'
        : viewer.participantState === 'requested'
          ? 'Your request is waiting for the host.'
          : viewer.participantState === 'declined'
            ? 'The host did not confirm your request.'
            : viewer.participantState === 'removed'
              ? 'The host removed you from this Gathering.'
              : viewer.participantState === 'left'
                ? 'You left this Gathering.'
                : null

  return (
    <main className="gathering-workspace">
      <header className="gathering-workspace-header">
        <Link to="/gatherings" className="circle-back-link">Gatherings</Link>
        <div className="circle-title-line">
          <span className="gathering-marker" data-state={detail.state} aria-hidden="true"><CalendarHeart size={24} aria-hidden="true" /></span>
          <div>
            <span className="eyebrow">Gathering</span>
            <h1>{detail.category}</h1>
            <p className="gathering-host-line">with {detail.companionDisplayName}{detail.companionCity ? ` · ${detail.companionCity}` : ''}</p>
          </div>
        </div>
        <div className="circle-facts">
          <span className="status-pill" data-tone={cancelled ? 'danger' : 'social'}>{gatheringStateLabel(detail.state)}</span>
          <span><Clock size={13} aria-hidden="true" /> <time dateTime={new Date(detail.startsAt).toISOString()}>{formatGatheringWhen(detail.startsAt)}</time></span>
          <span>{formatGatheringDuration(detail.durationMinutes)}</span>
          <span><MapPin size={13} aria-hidden="true" /> {gatheringModeLabel(detail.mode)}</span>
          <span><Users size={13} aria-hidden="true" /> {detail.confirmedCount}/{detail.capacity} confirmed · {gatheringSeatLabel(detail.confirmedCount, detail.capacity)}</span>
        </div>
      </header>

      {error && <p className="notice notice-danger" role="alert">{error}</p>}

      <div className="gathering-workspace-grid">
        <section className="gathering-main" aria-labelledby="gathering-participants-title">
          <div className="circle-section-heading">
            <h2 id="gathering-participants-title">Guests</h2>
            <span className="tabular">{detail.confirmedCount} confirmed{viewer.isHost && requestingCount > 0 ? ` · ${requestingCount} waiting` : ''}</span>
          </div>
          {participants.length === 0
            ? <div className="circle-state-card"><strong>No guests yet.</strong><p>{viewer.isHost ? 'Share an Invite so members can request a seat.' : 'Confirmed guests will appear here.'}</p></div>
            : <div className="gathering-participant-list">{participants.map((participant) => (
              <ParticipantRow
                key={participant.userId}
                participant={participant}
                canConfirm={viewer.canConfirm}
                busy={busy === `decide-${participant.userId}`}
                onDecide={(decision) => void run(`decide-${participant.userId}`, () => decideParticipant({ gatheringId: id, userId: participant.userId, decision }), decision === 'confirmed' ? 'Guest confirmed.' : decision === 'declined' ? 'Request declined.' : 'Guest removed.')}
              />
            ))}</div>}

          {viewer.isHost && !cancelled && (
            <section className="gathering-invite-composer" aria-labelledby="gathering-invite-title">
              <div className="circle-section-heading"><h2 id="gathering-invite-title">Post an Invite</h2><span>Recruit guests</span></div>
              <form onSubmit={(event) => {
                event.preventDefault()
                const body = inviteBody.trim()
                if (!body) return
                void run('invite', () => postInvite({
                  gatheringId: id,
                  body,
                  circleId: audience !== 'none' && audience !== 'profile' ? audience as Id<'circles'> : undefined,
                }), 'Invite posted.').then((ok) => { if (ok) setInviteBody('') })
              }}>
                <textarea className="field" required maxLength={1000} value={inviteBody} onChange={(event) => setInviteBody(event.currentTarget.value)} placeholder="Invite people to join this Gathering." />
                <div className="gathering-invite-row">
                  <label><span className="label">Audience</span>
                    <select className="field" value={audience} onChange={(event) => setAudience(event.currentTarget.value)}>
                      {inviteAudienceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <button className="btn btn-social" disabled={busy === 'invite' || !inviteBody.trim()}>{busy === 'invite' ? 'Posting...' : 'Post Invite'}</button>
                </div>
              </form>
            </section>
          )}
        </section>

        <aside className="gathering-side" aria-label="Gathering actions">
          <div className="gathering-action-panel">
            <h2>Your place</h2>
            {statusCopy && <p className="circle-membership-status" role="status">{statusCopy}</p>}
            {!cancelled && viewer.canRequestJoin && (
              <button type="button" className="btn btn-social" disabled={busy === 'join'} onClick={() => void run('join', () => requestJoin({ gatheringId: id }), 'Request sent to the host.')}>
                <UserPlus size={16} aria-hidden="true" /> {busy === 'join' ? 'Requesting...' : 'Request to join'}
              </button>
            )}
            {!viewer.isHost && !viewer.isCompanion && (viewer.participantState === 'requested' || viewer.participantState === 'confirmed') && (
              <button type="button" className="btn btn-ghost" disabled={busy === 'leave'} onClick={() => void run('leave', () => leave({ gatheringId: id }), 'You left the Gathering.')}>
                {busy === 'leave' ? 'Leaving...' : viewer.participantState === 'confirmed' ? 'Leave Gathering' : 'Withdraw request'}
              </button>
            )}
            {cancelled && <p className="text-meta">This Gathering was cancelled. Reserved host funds are released.</p>}
          </div>

          <div className="gathering-action-panel">
            <h2>Host</h2>
            <div className="gathering-host">
              <Avatar name={detail.hostDisplayName} src={detail.hostProfileImageUrl} size="small" />
              <span>{detail.hostDisplayName}{viewer.isHost ? ' (you)' : ''}</span>
            </div>
            <p className="text-meta">The host funds this session. Guests join at no charge.</p>
            {!cancelled && (viewer.isHost || viewer.isCompanion) && (
              <button type="button" className="btn btn-danger-quiet" onClick={() => setConfirmCancel(true)}>Cancel Gathering</button>
            )}
            {!cancelled && !viewer.isHost && !viewer.isCompanion && (
              <button type="button" className="btn btn-ghost" disabled={busy === 'report'} onClick={() => void run('report', () => report({ targetType: 'gathering', targetId: String(detail._id), reason: 'Gathering needs safety review' }), 'Gathering report sent to safety review.')}>
                <Shield size={15} aria-hidden="true" /> Report Gathering
              </button>
            )}
          </div>
        </aside>
      </div>

      <ConfirmationDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => void run('cancel', () => cancelGathering({ gatheringId: id, reason: 'Cancelled by the host' }), 'Gathering cancelled.').then((ok) => setConfirmCancel(!ok))}
        title="Cancel this Gathering?"
        description="Guests will be notified and any reserved host funds are released. This cannot be undone."
        confirmLabel="Cancel Gathering"
        busy={busy === 'cancel'}
      />
    </main>
  )
}
