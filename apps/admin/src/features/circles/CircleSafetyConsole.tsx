import { useState } from 'react'

export type CircleSafetyListItem = {
  _id: string
  slug: string
  name: string
  category: string
  mode: 'online' | 'in_person' | 'both'
  approximateArea?: string
  state: 'active' | 'archived' | 'suspended'
  settings?: {
    discoverability: 'listed' | 'unlisted'
    discussionVisibility: 'members_only' | 'signed_in'
    memberListVisibility: 'members_only' | 'signed_in'
    joinPolicy: 'approval_required' | 'open'
  }
  hasIcon?: boolean
  hasCover?: boolean
  host: { displayName: string; suspended: boolean } | null
  activeMemberCount: number
  pendingJoinCount: number
  hasPendingTransfer: boolean
  updatedAt: number
}

export type CircleSafetyDetail = {
  circle: {
    _id: string
    slug: string
    name: string
    purpose: string
    category: string
    rules: string[]
    mode: 'online' | 'in_person' | 'both'
    approximateArea?: string
    state: 'active' | 'archived' | 'suspended'
    settings?: {
      discoverability: 'listed' | 'unlisted'
      discussionVisibility: 'members_only' | 'signed_in'
      memberListVisibility: 'members_only' | 'signed_in'
      joinPolicy: 'approval_required' | 'open'
    }
    iconUrl?: string
    coverUrl?: string
    restoreState?: 'active' | 'archived'
    updatedAt: number
  }
  host: { displayName: string; suspended: boolean; identityApproved: boolean } | null
  pendingTransfer: { displayName: string } | null
  memberships: Array<{
    membershipId: string
    userId: string
    displayName: string
    username?: string
    accountRole: string
    accountSuspended: boolean
    state: string
    role: string
    identityApproved: boolean
    updatedAt: number
  }>
  posts: Array<{
    postId: string
    authorDisplayName: string
    body: string
    circleKind: string
    hidden: boolean
    deletedAt?: number
    removedAt?: number
    createdAt: number
  }>
  emergencyHostCandidates: Array<{ userId: string; displayName: string }>
}

type Props = {
  allowed: boolean
  rows: CircleSafetyListItem[] | undefined
  detail: CircleSafetyDetail | undefined
  selectedCircleId: string | null
  stateFilter: 'all' | 'active' | 'archived' | 'suspended'
  search: string
  onStateFilterChange: (value: 'all' | 'active' | 'archived' | 'suspended') => void
  onSearchChange: (value: string) => void
  onSelect: (circleId: string) => void
  onSetState: (circleId: string, state: 'active' | 'suspended') => Promise<void>
  onCancelTransfer: (circleId: string) => Promise<void>
  onRecoverHost: (circleId: string, recipientUserId: string, reason: string) => Promise<void>
}

type Confirmation =
  | { kind: 'suspend'; circleId: string; circleName: string }
  | { kind: 'cancel-transfer'; circleId: string; circleName: string; recipientName: string }
  | { kind: 'recover'; circleId: string; circleName: string }

export function CircleSafetyConsole(props: Props) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [recipientUserId, setRecipientUserId] = useState('')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!props.allowed) {
    return <div className="admin-empty">Circle safety is available only to full admins.</div>
  }

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true)
    setStatus(null)
    try {
      await action()
      setStatus({ tone: 'success', message: success })
      setConfirmation(null)
      setRecipientUserId('')
      setReason('')
    } catch (error) {
      setStatus({ tone: 'error', message: error instanceof Error ? error.message : 'The action failed.' })
    } finally {
      setBusy(false)
    }
  }

  const detail = props.detail

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Platform safety</p>
          <h1 className="text-h1 mt-2">Circles</h1>
          <p className="lede mt-2">Inspect user-owned Circles and intervene only when platform safety or ownership recovery requires it.</p>
        </div>
      </header>

      {status && <p className="circle-admin-notice" data-tone={status.tone} role={status.tone === 'error' ? 'alert' : 'status'}>{status.message}</p>}

      <div className="admin-filter-row">
        <label className="field-row">
          <span className="label">Status</span>
          <select className="field" value={props.stateFilter} onChange={(event) => props.onStateFilterChange(event.currentTarget.value as Props['stateFilter'])}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label className="field-row">
          <span className="label">Search</span>
          <input className="field" value={props.search} onChange={(event) => props.onSearchChange(event.currentTarget.value)} placeholder="Name or slug" />
        </label>
      </div>

      <div className="circle-admin-layout">
        <section aria-label="Circle list" className="circle-admin-list panel">
          {props.rows === undefined ? (
            <div className="admin-empty">Loading Circles...</div>
          ) : props.rows.length === 0 ? (
            <div className="admin-empty">No Circles match this filter.</div>
          ) : props.rows.map((circle) => (
            <button
              type="button"
              key={circle._id}
              className="circle-admin-list-item"
              aria-pressed={props.selectedCircleId === circle._id}
              onClick={() => props.onSelect(circle._id)}>
              <span className="admin-cell-primary">{circle.name}</span>
              <span className="admin-cell-muted">{circle.host?.displayName ?? 'Host unavailable'} · {circle.activeMemberCount} active</span>
              <span className="worklist-row-meta">
                <span className="status-pill" data-tone={circle.state === 'suspended' ? 'danger' : circle.state === 'active' ? 'success' : undefined}>{formatLabel(circle.state)}</span>
                {circle.settings?.discoverability === 'unlisted' && <span className="status-pill">Unlisted</span>}
                {circle.settings?.joinPolicy === 'open' && <span className="status-pill">Open join</span>}
                {circle.hasPendingTransfer && <span className="status-pill" data-tone="warning">Transfer pending</span>}
              </span>
            </button>
          ))}
        </section>

        <section aria-label="Circle safety detail" className="circle-admin-detail">
          {!props.selectedCircleId ? (
            <div className="admin-empty">Select a Circle to inspect its safety record.</div>
          ) : detail === undefined ? (
            <div className="admin-empty">Loading Circle details...</div>
          ) : (
            <>
              <div className="panel circle-admin-section">
                <div className="admin-section-heading">
                  <div>
                    <p className="eyebrow">{detail.circle.category}</p>
                    <h2 className="text-h2">{detail.circle.name}</h2>
                  </div>
                  <span className="status-pill" data-tone={detail.circle.state === 'suspended' ? 'danger' : detail.circle.state === 'active' ? 'success' : undefined}>{formatLabel(detail.circle.state)}</span>
                </div>
                <p className="text-body muted">{detail.circle.purpose}</p>
                <dl className="circle-admin-facts">
                  <div><dt>Host</dt><dd>{detail.host?.displayName ?? 'Unavailable'}</dd></div>
                  <div><dt>Mode</dt><dd>{formatLabel(detail.circle.mode)}</dd></div>
                  <div><dt>Area</dt><dd>{detail.circle.approximateArea ?? 'Not set'}</dd></div>
                  <div><dt>Pending transfer</dt><dd>{detail.pendingTransfer?.displayName ?? 'None'}</dd></div>
                  <div><dt>Discoverability</dt><dd>{detail.circle.settings ? formatLabel(detail.circle.settings.discoverability) : 'Listed (legacy default)'}</dd></div>
                  <div><dt>Discussions</dt><dd>{detail.circle.settings ? formatLabel(detail.circle.settings.discussionVisibility) : 'Members only (legacy default)'}</dd></div>
                  <div><dt>Member list</dt><dd>{detail.circle.settings ? formatLabel(detail.circle.settings.memberListVisibility) : 'Members only (legacy default)'}</dd></div>
                  <div><dt>Join policy</dt><dd>{detail.circle.settings ? formatLabel(detail.circle.settings.joinPolicy) : 'Approval required (legacy default)'}</dd></div>
                  <div><dt>Icon</dt><dd>{detail.circle.iconUrl ? <a href={detail.circle.iconUrl} target="_blank" rel="noreferrer">View icon</a> : 'None'}</dd></div>
                  <div><dt>Cover</dt><dd>{detail.circle.coverUrl ? <a href={detail.circle.coverUrl} target="_blank" rel="noreferrer">View cover</a> : 'None'}</dd></div>
                </dl>
                <div className="admin-action-stack mt-3">
                  {detail.circle.state === 'suspended' ? (
                    <button className="btn btn-neutral btn-sm" type="button" disabled={busy} onClick={() => void run(
                      () => props.onSetState(detail.circle._id, 'active'),
                      detail.circle.restoreState === 'archived' ? 'Circle restored as archived.' : 'Circle reactivated.',
                    )}>{detail.circle.restoreState === 'archived' ? 'Restore as archived' : 'Reactivate Circle'}</button>
                  ) : detail.circle.state === 'active' ? (
                    <button className="btn btn-danger btn-sm" type="button" disabled={busy} onClick={() => setConfirmation({ kind: 'suspend', circleId: detail.circle._id, circleName: detail.circle.name })}>Suspend Circle</button>
                  ) : null}
                  {detail.pendingTransfer && (
                    <button className="btn btn-neutral btn-sm" type="button" disabled={busy} onClick={() => setConfirmation({
                      kind: 'cancel-transfer',
                      circleId: detail.circle._id,
                      circleName: detail.circle.name,
                      recipientName: detail.pendingTransfer!.displayName,
                    })}>Cancel stuck transfer</button>
                  )}
                  <button className="btn btn-neutral btn-sm" type="button" disabled={busy || detail.emergencyHostCandidates.length === 0} onClick={() => setConfirmation({ kind: 'recover', circleId: detail.circle._id, circleName: detail.circle.name })}>Emergency ownership recovery</button>
                </div>
              </div>

              <div className="panel circle-admin-section">
                <div className="admin-section-heading"><h2 className="text-h3">Memberships</h2><span className="text-meta">{detail.memberships.length} records</span></div>
                <div className="circle-admin-records">
                  {detail.memberships.map((row) => (
                    <article key={row.membershipId} className="circle-admin-record">
                      <div><strong>{row.displayName}</strong><p className="text-tiny">@{row.username ?? 'no-username'} · {formatLabel(row.accountRole)}</p></div>
                      <div className="worklist-row-meta"><span>{formatLabel(row.role)}</span><span>{formatLabel(row.state)}</span>{row.accountSuspended && <span className="status-pill" data-tone="danger">Account suspended</span>}</div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="panel circle-admin-section">
                <div className="admin-section-heading"><h2 className="text-h3">Circle posts</h2><span className="text-meta">Latest {detail.posts.length}</span></div>
                {detail.posts.length === 0 ? <p className="text-meta">No Circle posts.</p> : (
                  <div className="circle-admin-records">
                    {detail.posts.map((post) => (
                      <article key={post.postId} className="circle-admin-record circle-admin-post">
                        <div className="worklist-row-meta"><strong>{post.authorDisplayName}</strong><span>{formatLabel(post.circleKind)}</span><time>{new Date(post.createdAt).toLocaleString()}</time></div>
                        <p>{post.body}</p>
                        {(post.hidden || post.deletedAt || post.removedAt) && <span className="status-pill" data-tone="danger">Unavailable to members</span>}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {confirmation && (
        <div className="circle-admin-dialog-backdrop">
          <div className="panel circle-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="circle-admin-dialog-title">
            <h2 className="text-h2" id="circle-admin-dialog-title">{
              confirmation.kind === 'suspend'
                ? `Suspend ${confirmation.circleName}?`
                : confirmation.kind === 'cancel-transfer'
                  ? `Cancel the transfer for ${confirmation.circleName}?`
                  : `Recover ownership of ${confirmation.circleName}?`
            }</h2>
            {confirmation.kind === 'suspend' ? (
              <>
                <p className="text-body muted">Members will lose access to Circle content and cannot post until a full admin reactivates it.</p>
                <div className="admin-action-stack">
                  <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setConfirmation(null)}>Keep active</button>
                  <button className="btn btn-danger" type="button" disabled={busy} onClick={() => void run(() => props.onSetState(confirmation.circleId, 'suspended'), 'Circle suspended.')}>Confirm suspension</button>
                </div>
              </>
            ) : confirmation.kind === 'cancel-transfer' ? (
              <>
                <p className="text-body muted">{confirmation.recipientName} will no longer be able to accept ownership. The current host will keep the Circle.</p>
                <div className="admin-action-stack">
                  <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setConfirmation(null)}>Keep transfer</button>
                  <button className="btn btn-neutral" type="button" disabled={busy} onClick={() => void run(() => props.onCancelTransfer(confirmation.circleId), 'Pending transfer cancelled.')}>Confirm cancellation</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-body muted">Use this only when the current host cannot act. The selected verified member becomes the only host and any pending transfer is cancelled.</p>
                <label className="field-row">
                  <span className="label">New host</span>
                  <select className="field" value={recipientUserId} onChange={(event) => setRecipientUserId(event.currentTarget.value)}>
                    <option value="">Select an eligible member</option>
                    {detail?.emergencyHostCandidates.map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidate.displayName}</option>)}
                  </select>
                </label>
                <label className="field-row">
                  <span className="label">Internal reason</span>
                  <textarea className="field" value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="Why the current host cannot act" />
                </label>
                <div className="admin-action-stack">
                  <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button>
                  <button className="btn btn-neutral" type="button" disabled={busy || !recipientUserId || !reason.trim()} onClick={() => void run(() => props.onRecoverHost(confirmation.circleId, recipientUserId, reason), 'Circle ownership recovered.')}>Confirm recovery</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function formatLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ')
}
