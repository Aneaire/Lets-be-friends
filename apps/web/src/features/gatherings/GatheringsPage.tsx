import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { CalendarHeart, MapPin, Plus, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Calendar } from '../../design-system/organisms/Calendar'
import { Avatar } from '../../design-system/atoms/Avatar'
import { formatGatheringDuration, formatGatheringWhen, gatheringModeLabel, gatheringSeatLabel, gatheringStateLabel } from './gatheringPresentation'

type GatheringSummary = NonNullable<ReturnType<typeof useQuery<typeof api.gatherings.mine>>>[number]
type ApprovedCompanion = NonNullable<ReturnType<typeof useQuery<typeof api.companions.listApproved>>>[number]

const DURATIONS = [30, 60, 90, 120] as const

function GatheringRow({ gathering }: { gathering: GatheringSummary }) {
  const hostLabel = gathering.viewer.isHost ? 'Hosting' : 'Joined'
  return (
    <Link to="/gatherings/$gatheringId" params={{ gatheringId: gathering._id }} className="gathering-row">
      <span className="gathering-row-marker" data-cancelled={gathering.state === 'cancelled'} aria-hidden="true">
        <CalendarHeart size={19} aria-hidden="true" />
      </span>
      <span className="gathering-row-copy">
        <span className="gathering-row-title">
          <strong>{gathering.category}</strong>
          <span className="status-pill" data-tone={gathering.state === 'cancelled' ? 'danger' : 'social'}>{gatheringStateLabel(gathering.state)}</span>
          <span className="status-pill">{hostLabel}</span>
        </span>
        <span className="gathering-row-meta">
          <span><Users size={13} aria-hidden="true" /> {gathering.confirmedCount}/{gathering.capacity} confirmed</span>
          <span><MapPin size={13} aria-hidden="true" /> {gatheringModeLabel(gathering.mode)}</span>
        </span>
      </span>
      <span className="gathering-row-when">
        <time dateTime={new Date(gathering.startsAt).toISOString()}>{formatGatheringWhen(gathering.startsAt)}</time>
        <small>{formatGatheringDuration(gathering.durationMinutes)} · {gatheringSeatLabel(gathering.confirmedCount, gathering.capacity)}</small>
      </span>
    </Link>
  )
}

function CreateGatheringForm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const companions = useQuery(api.companions.listApproved, {})
  const circles = useQuery(api.circles.mine)
  const createGathering = useMutation(api.gatherings.create)
  const postInvite = useMutation(api.gatherings.postInvite)

  const bookable = useMemo(
    () => (Array.isArray(companions) ? companions : []).filter((companion: ApprovedCompanion) => companion.bookable && companion.viewerCanBook),
    [companions],
  )
  const myCircles = useMemo(
    () => (Array.isArray(circles) ? circles : []).filter((circle) => circle.membershipState === 'active'),
    [circles],
  )

  const [companionProfileId, setCompanionProfileId] = useState('')
  const [category, setCategory] = useState('')
  const [mode, setMode] = useState<'online' | 'in_person'>('online')
  const [day, setDay] = useState<Date | null>(null)
  const [time, setTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState<number>(60)
  const [capacity, setCapacity] = useState(4)
  const [guestListVisibility, setGuestListVisibility] = useState<'confirmed_only' | 'public'>('confirmed_only')
  const [inviteBody, setInviteBody] = useState('')
  const [audience, setAudience] = useState('profile')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selected = bookable.find((companion: ApprovedCompanion) => companion._id === companionProfileId) ?? null
  const availableModes = selected ? (selected.mode === 'both' ? ['online', 'in_person'] as const : [selected.mode] as const) : (['online', 'in_person'] as const)
  const categories = selected?.categories ?? []

  function selectCompanion(nextId: string) {
    setCompanionProfileId(nextId)
    const next = bookable.find((companion: ApprovedCompanion) => companion._id === nextId) ?? null
    setCategory(next?.categories[0] ?? '')
    setMode(next && next.mode !== 'both' ? next.mode : 'online')
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!selected || !category || !day || !time) {
      setError('Choose a Companion, category, date, and time.')
      return
    }
    const [hours, minutes] = time.split(':').map(Number)
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      setError('Choose a start time.')
      return
    }
    const startsAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).getTime()
    if (startsAt <= Date.now()) {
      setError('Choose a time in the future.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const created = await createGathering({
        companionProfileId: selected._id,
        category,
        mode,
        startsAt,
        durationMinutes,
        capacity,
        guestListVisibility,
      })
      if (inviteBody.trim()) {
        await postInvite({
          gatheringId: created.gatheringId,
          body: inviteBody.trim(),
          circleId: audience.startsWith('circle:') ? audience.slice('circle:'.length) as Id<'circles'> : undefined,
        })
      }
      toast.success('Gathering created.')
      await navigate({ to: '/gatherings/$gatheringId', params: { gatheringId: created.gatheringId } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Gathering could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="gathering-create-panel" aria-labelledby="create-gathering-title">
      <div className="gathering-create-heading">
        <div>
          <span className="eyebrow">Host a group experience</span>
          <h2 id="create-gathering-title">Create a Gathering</h2>
        </div>
        <button type="button" className="icon-button" aria-label="Close Gathering form" onClick={onClose}><X size={18} /></button>
      </div>
      <p className="gathering-create-note">You fund the session. Guests join at no charge.</p>
      {error && <p className="notice notice-danger" role="alert">{error}</p>}
      <form className="gathering-form" onSubmit={(event) => void onSubmit(event)}>
        <div className="gathering-form-grid">
          <label className="gathering-form-wide">
            <span>Companion</span>
            <select className="field" required value={companionProfileId} onChange={(event) => selectCompanion(event.currentTarget.value)}>
              <option value="" disabled>Choose a Companion</option>
              {bookable.map((companion: ApprovedCompanion) => <option key={companion._id} value={companion._id}>{companion.displayName} · {companion.city}</option>)}
            </select>
            <small>Only approved Companions you can book appear here.</small>
          </label>
          <label>
            <span>Experience</span>
            <select className="field" required value={category} onChange={(event) => setCategory(event.currentTarget.value)} disabled={!selected}>
              <option value="" disabled>{selected ? 'Choose an experience' : 'Choose a Companion first'}</option>
              {categories.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Mode</span>
            <select className="field" value={mode} onChange={(event) => setMode(event.currentTarget.value as 'online' | 'in_person')} disabled={!selected}>
              {availableModes.map((option) => <option key={option} value={option}>{gatheringModeLabel(option)}</option>)}
            </select>
          </label>
          <div className="gathering-form-wide gathering-form-datetime">
            <span className="label">Date</span>
            <Calendar value={day} variant="social" aria-label="Gathering date" min={new Date()} onChange={setDay} />
            <label><span>Start time</span><input className="field" type="time" required value={time} onChange={(event) => setTime(event.currentTarget.value)} /></label>
            <label>
              <span>Duration</span>
              <select className="field" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.currentTarget.value))}>
                {DURATIONS.map((minutes) => <option key={minutes} value={minutes}>{formatGatheringDuration(minutes)}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Capacity</span>
            <input className="field" type="number" min={2} max={50} required value={capacity} onChange={(event) => setCapacity(Number(event.currentTarget.value))} />
            <small>You confirm each guest, up to this limit.</small>
          </label>
          <label>
            <span>Guest list</span>
            <select className="field" value={guestListVisibility} onChange={(event) => setGuestListVisibility(event.currentTarget.value as 'confirmed_only' | 'public')}>
              <option value="confirmed_only">Confirmed guests and host only</option>
              <option value="public">Everyone who can see the Invite</option>
            </select>
          </label>
          <label className="gathering-form-wide">
            <span>Invite message (optional)</span>
            <textarea className="field" maxLength={1000} value={inviteBody} onChange={(event) => setInviteBody(event.currentTarget.value)} placeholder="Tell people what you are planning and who it is for." />
          </label>
          <label className="gathering-form-wide">
            <span>Invite audience</span>
            <select className="field" value={audience} onChange={(event) => setAudience(event.currentTarget.value)} disabled={!inviteBody.trim()}>
              <option value="none">Do not post an Invite yet</option>
              <option value="profile">My profile</option>
              {myCircles.map((circle) => <option key={circle._id} value={`circle:${circle._id}`}>{circle.name}</option>)}
            </select>
            <small>Posting to a Circle notifies its members. Posting to your profile reaches people who visit it.</small>
          </label>
        </div>
        <div className="gathering-form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-self" disabled={busy || !selected || !category || !day || !time}>{busy ? 'Creating...' : 'Create Gathering'}</button>
        </div>
      </form>
    </section>
  )
}

export function GatheringsPage() {
  const mine = useQuery(api.gatherings.mine)
  const [creating, setCreating] = useState(false)
  const rows = Array.isArray(mine) ? mine : []
  const hosting = rows.filter((row) => row.viewer.isHost)
  const joined = rows.filter((row) => !row.viewer.isHost)
  const loading = mine === undefined

  return (
    <main className="gatherings-page">
      <header className="gatherings-header">
        <div>
          <span className="eyebrow">Shared experiences</span>
          <h1>Gatherings</h1>
          <p>Host a Companion experience and invite others, or join a Gathering someone else is hosting.</p>
        </div>
        <div className="gatherings-header-actions">
          <button type="button" className="btn btn-self" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> Create Gathering</button>
          <CalendarHeart size={42} strokeWidth={1.25} aria-hidden="true" />
        </div>
      </header>

      {creating && <CreateGatheringForm onClose={() => setCreating(false)} />}

      {loading ? <div className="circle-state-card" role="status"><strong>Loading Gatherings...</strong></div> : (
        <>
          <section className="gatherings-section" aria-labelledby="hosting-gatherings-title">
            <div className="circle-section-heading"><h2 id="hosting-gatherings-title">Hosting</h2><span className="tabular">{hosting.length}</span></div>
            {hosting.length ? <div className="gathering-list">{hosting.map((gathering) => <GatheringRow key={gathering._id} gathering={gathering} />)}</div> : (
              <div className="circle-state-card"><strong>You are not hosting a Gathering yet.</strong><p>Create one to book a Companion and invite others.</p></div>
            )}
          </section>

          <section className="gatherings-section" aria-labelledby="joined-gatherings-title">
            <div className="circle-section-heading"><h2 id="joined-gatherings-title">Joined</h2><span className="tabular">{joined.length}</span></div>
            {joined.length ? <div className="gathering-list">{joined.map((gathering) => <GatheringRow key={gathering._id} gathering={gathering} />)}</div> : (
              <div className="circle-state-card"><strong>You have not joined a Gathering.</strong><p>Invites shared in Circles and on profiles appear here once you request a seat.</p></div>
            )}
          </section>
        </>
      )}
    </main>
  )
}

export function GatheringInviteSummary({ gatheringId }: { gatheringId: Id<'gatherings'> }) {
  const gathering = useQuery(api.gatherings.get, { gatheringId })
  const host = gathering?.hostDisplayName ?? 'Host'
  return (
    <Link to="/gatherings/$gatheringId" params={{ gatheringId }} className="gathering-invite-card">
      <Avatar name={host} size="small" />
      <span className="gathering-invite-copy">
        <strong>{gathering ? `${gathering.category} with ${gathering.companionDisplayName}` : 'Gathering invite'}</strong>
        <span>{gathering ? `${formatGatheringWhen(gathering.startsAt)} · ${gatheringSeatLabel(gathering.confirmedCount, gathering.capacity)}` : 'Open to see the details'}</span>
      </span>
      <span className="btn btn-social btn-sm" aria-hidden="true">View Gathering</span>
    </Link>
  )
}
