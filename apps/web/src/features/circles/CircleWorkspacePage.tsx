import { pollValidationError } from '@lets-be-friends/shared'
import { Link } from '@tanstack/react-router'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Bell, BellOff, Check, ChevronLeft, ChevronRight, Flag, Heart, ImagePlus, LogOut, MapPin, MessageCircle, Pin, Plus, Shield, UserMinus, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Avatar } from '../../design-system/atoms/Avatar'
import { BrandLogo } from '../../design-system/atoms/BrandLogo'
import { ActionMenu } from '../../design-system/molecules/ActionMenu'
import { ConfirmationDialog } from '../../design-system/molecules/Dialog'
import { InfiniteScrollTrigger } from '../../design-system/molecules/InfiniteScrollTrigger'
import { Calendar } from '../../design-system/organisms/Calendar'
import { PostCard } from '../social/PostCard'
import { PostActionBar } from '../social/PostActionBar'
import { PostMediaGrid } from '../social/PostMediaGrid'
import { PollCard } from '../social/PollCard'
import { PollComposer, emptyPollDraft, type PollDraft } from '../social/PollComposer'
import { SocialLightbox } from '../social/SocialLightbox'
import { discardRegisteredUploads, mediaKind, uploadPostMedia, type SelectedMedia } from '../social/postMediaUpload'

type CircleTab = 'discussions' | 'about' | 'members' | 'manage' | 'removed' | 'pending'
type CirclePost = NonNullable<FunctionReturnType<typeof api.social.circleFeed>>['page'][number]
type CircleComment = NonNullable<FunctionReturnType<typeof api.social.commentsForPost>>[number]

const MAX_CIRCLE_POST_MEDIA = 3

const memberTabs: Array<{ id: CircleTab; label: string }> = [
  { id: 'discussions', label: 'Discussions' },
  { id: 'about', label: 'About' },
  { id: 'members', label: 'Members' },
]

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(timestamp)
}

export function CircleWorkspacePage({ circleId, postId, commentId }: { circleId: string; postId?: string; commentId?: string }) {
  const id = circleId as Id<'circles'>
  const detail = useQuery(api.circles.detail, { circleId: id })
  const [tab, setTab] = useState<CircleTab>('discussions')
  const [rulesAccepted, setRulesAccepted] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmAcceptTransfer, setConfirmAcceptTransfer] = useState(false)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const requestJoin = useMutation(api.circles.requestToJoin)
  const cancelJoin = useMutation(api.circles.cancelJoinRequest)
  const leave = useMutation(api.circles.leave)
  const setMuted = useMutation(api.circles.setMuted)
  const report = useMutation(api.reports.create)
  const acceptHostTransfer = useMutation(api.circles.acceptHostTransfer)

  async function run(action: string, callback: () => Promise<unknown>, success: string) {
    setBusy(action)
    setError('')
    try {
      await callback()
      toast.success(success)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The action could not be completed.')
    } finally {
      setBusy('')
    }
  }

  if (detail === undefined) return <main className="circle-workspace"><div className="circle-state-card" role="status"><strong>Loading Circle...</strong></div></main>
  if (detail.unavailable) {
    return <main className="circle-workspace"><div className="circle-state-card circle-state-card-centered"><h1>Circle unavailable</h1><p>This Circle is not open to members right now.</p><Link to="/circles" className="btn btn-neutral btn-sm">Back to Circles</Link></div></main>
  }

  const membershipState = detail.membershipState
  const active = membershipState === 'active'
  const canRequest = membershipState === null || ['left', 'removed', 'rejected'].includes(membershipState ?? '')
  const statusCopy = membershipState === 'requested'
    ? 'Your request is waiting for a host or moderator.'
    : membershipState === 'rejected'
      ? 'Your earlier request was not approved. You can request to join again.'
      : membershipState === 'banned'
        ? 'You cannot request access to this Circle.'
        : membershipState === 'removed'
          ? 'Your membership ended. You can request to join again.'
          : null
  const tabs = [
    ...memberTabs,
    ...(detail.canModerate ? [{ id: 'pending' as const, label: 'Pending' }] : []),
    ...(detail.canModerate ? [{ id: 'removed' as const, label: 'Removed' }] : []),
    ...(detail.isCanonicalHost ? [{ id: 'manage' as const, label: 'Manage' }] : []),
  ]
  const circleOptions = [
    ...(detail.circleState === 'active'
      ? [{
        label: 'Report Circle',
        icon: <Flag size={15} aria-hidden="true" />,
        tone: 'danger' as const,
        onSelect: () => void run('report-circle', () => report({ targetType: 'circle', targetId: id, reason: 'Circle needs safety review' }), 'Circle report sent to safety review.'),
      }]
      : []),
    {
      label: detail.muted ? 'Unmute' : 'Mute',
      icon: detail.muted ? <Bell size={15} aria-hidden="true" /> : <BellOff size={15} aria-hidden="true" />,
      onSelect: () => void run('mute', () => setMuted({ circleId: id, muted: !detail.muted }), detail.muted ? 'Circle notifications turned on.' : 'Circle muted.'),
    },
    ...(!detail.isCanonicalHost
      ? [{
        label: 'Leave',
        icon: <LogOut size={15} aria-hidden="true" />,
        tone: 'danger' as const,
        onSelect: () => setConfirmLeave(true),
      }]
      : []),
  ]

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    setTab(tabs[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <main className="circle-workspace">
      <ConfirmationDialog open={confirmLeave} onClose={() => setConfirmLeave(false)} onConfirm={() => void run('leave', () => leave({ circleId: id }), 'You left the Circle.').then(() => setConfirmLeave(false))} title="Leave this Circle?" description="You will lose access to its discussions and member list. You can request to join again later." confirmLabel="Leave Circle" busy={busy === 'leave'} />
      <ConfirmationDialog open={confirmAcceptTransfer} onClose={() => setConfirmAcceptTransfer(false)} onConfirm={() => void run('accept-transfer', () => acceptHostTransfer({ circleId: id }), 'You are now the Circle host.').then(() => setConfirmAcceptTransfer(false))} title="Accept Circle ownership?" description="You will become responsible for this Circle, its member access, and its moderation settings. The current host will become a member." confirmLabel="Accept ownership" intent="neutral" busy={busy === 'accept-transfer'} />
      <header className="circle-workspace-header">
        <Link to="/circles" className="circle-back-link">Circles</Link>
        {detail.coverUrl && <img className="circle-cover" src={detail.coverUrl} alt="" aria-hidden="true" />}
        <div className="circle-title-line">
          {detail.iconUrl
            ? <img className="circle-icon circle-icon-large" src={detail.iconUrl} alt={`${detail.name} Circle icon`} />
            : <span className="circle-marker circle-marker-large" data-member={active} aria-hidden="true"><BrandLogo className="circle-marker-logo" /></span>}
          <div><span className="eyebrow">{detail.category}</span><h1>{detail.name}</h1></div>
        </div>
        <p>{detail.purpose}</p>
        <div className="circle-facts">
          <span><Users size={14} aria-hidden="true" /> {detail.memberCount} {detail.memberCount === 1 ? 'member' : 'members'}</span>
          <span><MapPin size={14} aria-hidden="true" /> {detail.approximateArea ?? (detail.mode === 'online' ? 'Online' : 'Area shared in Circle')}</span>
          {detail.circleState === 'archived' && <span className="status-pill">Archived, read-only</span>}
          {detail.role && detail.role !== 'member' && <span className="status-pill" data-tone="social">{detail.role}</span>}
        </div>
      </header>

      {error && <div className="notice notice-danger" role="alert"><span>{error}</span></div>}
      {detail.pendingTransferForViewer && <section className="circle-transfer-offer" aria-labelledby="circle-transfer-offer-title"><div><h2 id="circle-transfer-offer-title">You have been invited to host this Circle.</h2><p>Review the Circle before accepting responsibility for its members and settings.</p></div><button type="button" className="btn btn-neutral" onClick={() => setConfirmAcceptTransfer(true)}>Accept host transfer</button></section>}

      {!active ? (
        <>
          <section className="circle-preview-grid" aria-label="Circle preview">
            <article className="circle-preview-panel"><h2>About this Circle</h2><h3>Hosted by</h3><p>{detail.host?.displayName ?? 'Circle host'}</p>
              <h3>Visibility</h3>
              <ul className="circle-visibility-list">
                <li>{detail.discoverability === 'unlisted' ? 'Unlisted. Reachable only by direct link.' : 'Listed in Discover.'}</li>
                <li>{detail.discussionVisibility === 'signed_in' ? 'Discussions open to signed-in members. Join to post, react, or comment.' : 'Discussions open to active members only.'}</li>
                <li>{detail.memberListVisibility === 'signed_in' ? 'Member list open to signed-in members.' : 'Member list open to active members only.'}</li>
              </ul>
            </article>
            <aside className="circle-join-panel">
              <h2>{membershipState === 'requested' ? 'Request pending' : membershipState === 'banned' ? 'Access unavailable' : detail.joinPolicy === 'open' ? 'Join this Circle' : 'Request to join'}</h2>
              {statusCopy && <p className="circle-membership-status" role="status">{statusCopy}</p>}
              {detail.joinPolicy === 'open' && canRequest && <p className="text-meta">This Circle admits new members instantly. Joining adds you as an active member right away.</p>}
              <ol className="circle-rule-list">{detail.rules.map((rule, index) => <li key={`${index}-${rule}`}>{rule}</li>)}</ol>
              {canRequest && <label className="circle-rules-check"><input type="checkbox" checked={rulesAccepted} onChange={(event) => setRulesAccepted(event.currentTarget.checked)} /><span>I have read and agree to follow these rules.</span></label>}
              {canRequest && <button type="button" className="btn btn-social" disabled={!rulesAccepted || Boolean(busy)} onClick={() => void run('join', () => requestJoin({ circleId: id, rulesAcknowledged: rulesAccepted }), detail.joinPolicy === 'open' ? 'You joined the Circle.' : 'Join request sent.')}>{busy === 'join' ? 'Sending...' : detail.joinPolicy === 'open' ? 'Join Circle' : membershipState === 'rejected' || membershipState === 'removed' || membershipState === 'left' ? 'Request to join again' : 'Request to join'}</button>}
              {membershipState === 'requested' && <button type="button" className="btn btn-neutral" disabled={Boolean(busy)} onClick={() => void run('cancel', () => cancelJoin({ circleId: id }), 'Join request cancelled.')}>{busy === 'cancel' ? 'Cancelling...' : 'Cancel request'}</button>}
              {membershipState !== 'banned' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void run('report-circle', () => report({ targetType: 'circle', targetId: id, reason: 'Circle needs safety review' }), 'Circle report sent to safety review.')}>Report Circle</button>}
            </aside>
          </section>
          {detail.canReadDiscussion && <CircleEventsCarousel circleId={id} canLead={false} />}
          {detail.canReadDiscussion && <CirclePreviewDiscussions circleId={id} />}
          {detail.canReadMembers && <CirclePreviewMembers circleId={id} />}
        </>
      ) : (
        <>
          <div className="circle-workspace-tools">
            <div className="circle-tabs" role="tablist" aria-label="Circle sections">
              {tabs.map((item, index) => <button key={item.id} ref={(node) => { tabRefs.current[index] = node }} type="button" role="tab" id={`circle-tab-${item.id}`} aria-controls={`circle-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onKeyDown={(event) => onTabKeyDown(event, index)} onClick={() => setTab(item.id)}>{item.label}</button>)}
            </div>
            <div className="circle-member-actions">
              <ActionMenu label="Circle options" items={circleOptions} />
            </div>
          </div>
          <section id={`circle-panel-${tab}`} role="tabpanel" aria-labelledby={`circle-tab-${tab}`}>
            {tab === 'discussions' && <CircleDiscussions detail={detail} circleId={id} postId={postId} commentId={commentId} />}
            {tab === 'about' && <CircleAbout detail={detail} />}
            {tab === 'members' && <CircleMembers circleId={id} canModerate={detail.canModerate} />}
            {tab === 'pending' && detail.canModerate && <CirclePendingPosts circleId={id} />}
            {tab === 'removed' && detail.canModerate && (
              <div className="circle-removed-panel">
                <p className="text-meta">Removed posts and comments stay hidden from members until a leader restores them.</p>
                <CircleRemovedContent circleId={id} onModerationAction={(callback, success) => run('restore', callback, success ?? 'Content restored.')} />
              </div>
            )}
            {tab === 'manage' && detail.isCanonicalHost && <CircleManage circleId={id} />}
          </section>
        </>
      )}
    </main>
  )
}

function CirclePreviewDiscussions({ circleId }: { circleId: Id<'circles'> }) {
  const { results, status, loadMore } = usePaginatedQuery(api.social.circleFeed, { circleId }, { initialNumItems: 10 })
  return (
    <section className="circle-preview-section" aria-labelledby="circle-preview-discussions-title">
      <div className="circle-section-heading"><h2 id="circle-preview-discussions-title">Recent discussions</h2><span>Read-only preview</span></div>
      <p className="text-meta">Visible to signed-in members. Join this Circle to post, react, or comment.</p>
      {status === 'LoadingFirstPage' ? <div className="circle-state-card" role="status">Loading discussions...</div> : results.length === 0 ? <div className="circle-state-card"><strong>No discussions yet.</strong></div> : (
        <div className="circle-post-list">{results.map((post) => (
          <article key={post._id} className="circle-state-card"><strong>{post.authorDisplayName}</strong><p className="circle-post-body">{post.body}</p><span className="text-meta tabular">{formatTime(post.createdAt)}</span></article>
        ))}</div>
      )}
      <InfiniteScrollTrigger
        status={status}
        onLoadMore={() => loadMore(10)}
        loadingLabel="Loading more discussions..."
        className="circle-load-more"
      />
    </section>
  )
}

function CirclePreviewMembers({ circleId }: { circleId: Id<'circles'> }) {
  const members = useQuery(api.circles.members, { circleId })
  if (members === undefined) return <div className="circle-state-card" role="status">Loading members...</div>
  return (
    <section className="circle-preview-section" aria-labelledby="circle-preview-members-title">
      <div className="circle-section-heading"><h2 id="circle-preview-members-title">Members</h2><span className="tabular">{members.length}</span></div>
      <p className="text-meta">Active members only. Membership requests and past members are never shown here.</p>
      <div className="circle-member-list">
        {members.map((member) => (
          <article key={member.userId}>
            <Avatar name={member.displayName} src={member.profileImageUrl} size="large" className="ds-post-avatar-image" />
            <div><strong>{member.displayName}</strong><span>{member.username ? `@${member.username}` : 'Member'} · {member.role}</span></div>
          </article>
        ))}
      </div>
    </section>
  )
}

function CircleAbout({ detail }: { detail: Exclude<NonNullable<ReturnType<typeof useQuery<typeof api.circles.detail>>>, { unavailable: true }> }) {
  const host = detail.host
  return (
    <div className="circle-about-grid">
      <article><h2>Purpose</h2><p>{detail.purpose}</p><h2>Circle rules</h2><ol className="circle-rule-list">{detail.rules.map((rule, index) => <li key={`${index}-${rule}`}>{rule}</li>)}</ol></article>
      <aside className="circle-host-card" aria-labelledby="circle-host-title">
        <h2 id="circle-host-title">Host</h2>
        {host ? (
          <Link to="/member-profile" search={{ userId: host.userId }} className="circle-host-link" aria-label={`View ${host.displayName}'s profile`}>
            <Avatar name={host.displayName} src={host.profileImageUrl} size="large" decorative />
            <span className="circle-host-copy">
              <strong>{host.displayName}</strong>
              <span>{host.username ? `@${host.username}` : 'Circle host'}</span>
            </span>
            <span className="status-pill" data-tone="social">Host</span>
          </Link>
        ) : (
          <p className="text-meta">Circle host</p>
        )}
      </aside>
    </div>
  )
}

type ManageConfirmation =
  | { kind: 'revoke'; membershipId: Id<'circleMemberships'>; displayName: string }
  | { kind: 'unban'; membershipId: Id<'circleMemberships'>; displayName: string }
  | { kind: 'transfer'; userId: Id<'users'>; displayName: string }
  | { kind: 'cancel-transfer'; displayName: string }
  | { kind: 'lifecycle'; state: 'active' | 'archived' }

function CircleManage({ circleId }: { circleId: Id<'circles'> }) {
  const management = useQuery(api.circles.hostManagement, { circleId })
  const edit = useMutation(api.circles.edit)
  const updateSettings = useMutation(api.circles.updateSettings)
  const generateImageUploadUrl = useMutation(api.circles.generateCircleImageUploadUrl)
  const setImage = useMutation(api.circles.setCircleImage)
  const removeImage = useMutation(api.circles.removeCircleImage)
  const setModerator = useMutation(api.circles.setModerator)
  const unban = useMutation(api.circles.unbanMember)
  const initiateTransfer = useMutation(api.circles.initiateHostTransfer)
  const cancelTransfer = useMutation(api.circles.cancelHostTransfer)
  const setState = useMutation(api.circles.setState)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<ManageConfirmation | null>(null)

  async function act(callback: () => Promise<unknown>, success: string) {
    try {
      setError('')
      await callback()
      toast.success(success)
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Circle setting could not be updated.')
      return false
    }
  }

  if (management === undefined) return <div className="circle-state-card" role="status">Loading Circle management...</div>
  const confirmationCopy = confirmation?.kind === 'revoke'
    ? { title: `Remove ${confirmation.displayName} as moderator?`, description: `${confirmation.displayName} will keep Circle membership but lose moderation access.`, label: 'Remove moderator', intent: 'neutral' as const }
    : confirmation?.kind === 'unban'
      ? { title: `Unban ${confirmation.displayName}?`, description: `${confirmation.displayName} can request to join this Circle again.`, label: 'Unban member', intent: 'neutral' as const }
      : confirmation?.kind === 'transfer'
        ? { title: `Offer ownership to ${confirmation.displayName}?`, description: `${confirmation.displayName} must accept before your host role changes. You can cancel while the offer is pending.`, label: 'Offer ownership', intent: 'neutral' as const }
        : confirmation?.kind === 'cancel-transfer'
          ? { title: 'Cancel ownership transfer?', description: `${confirmation.displayName} will no longer be able to accept this ownership offer.`, label: 'Cancel transfer', intent: 'neutral' as const }
          : confirmation?.kind === 'lifecycle' && confirmation.state === 'archived'
            ? { title: 'Archive this Circle?', description: 'Members will keep read-only access. New posts, replies, reactions, and join requests will stop until you reactivate it.', label: 'Archive Circle', intent: 'danger' as const }
            : { title: 'Reactivate this Circle?', description: 'Members can post, reply, react, and manage requests again.', label: 'Reactivate Circle', intent: 'self' as const }

  async function confirmAction() {
    if (!confirmation) return
    let completed = false
    if (confirmation.kind === 'revoke') completed = await act(() => setModerator({ membershipId: confirmation.membershipId, moderator: false }), 'Moderator role removed.')
    if (confirmation.kind === 'unban') completed = await act(() => unban({ membershipId: confirmation.membershipId }), 'Member unbanned.')
    if (confirmation.kind === 'transfer') completed = await act(() => initiateTransfer({ circleId, recipientUserId: confirmation.userId }), 'Ownership offer sent.')
    if (confirmation.kind === 'cancel-transfer') completed = await act(() => cancelTransfer({ circleId }), 'Ownership transfer cancelled.')
    if (confirmation.kind === 'lifecycle') completed = await act(() => setState({ circleId, state: confirmation.state }), confirmation.state === 'archived' ? 'Circle archived.' : 'Circle reactivated.')
    if (completed) setConfirmation(null)
  }

  return (
    <div className="circle-manage-layout">
      <ConfirmationDialog open={confirmation !== null} onClose={() => setConfirmation(null)} onConfirm={confirmAction} title={confirmationCopy.title} description={confirmationCopy.description} confirmLabel={confirmationCopy.label} intent={confirmationCopy.intent} />
      {error && <p className="notice notice-danger" role="alert">{error}</p>}
      <section className="circle-manage-section" aria-labelledby="circle-settings-title">
        <div className="circle-section-heading"><h2 id="circle-settings-title">Circle settings</h2><span>Host only</span></div>
        <form className="circle-manage-form" onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const rules = String(data.get('rules') ?? '').split('\n').map((rule) => rule.trim()).filter(Boolean)
          void act(() => edit({
            circleId,
            name: String(data.get('name') ?? ''),
            purpose: String(data.get('purpose') ?? ''),
            category: String(data.get('category') ?? ''),
            mode: String(data.get('mode') ?? 'online') as 'online' | 'in_person' | 'both',
            approximateArea: String(data.get('approximateArea') ?? '') || undefined,
            rules,
          }), 'Circle settings saved.')
        }}>
          <div className="circle-form-grid">
            <label><span>Name</span><input className="field" name="name" required maxLength={80} defaultValue={management.circle.name} /></label>
            <label><span>Category</span><input className="field" name="category" required maxLength={60} defaultValue={management.circle.category} /></label>
            <label className="circle-form-wide"><span>Purpose</span><textarea className="field" name="purpose" required maxLength={500} defaultValue={management.circle.purpose} /></label>
            <label><span>Mode</span><select className="field" name="mode" defaultValue={management.circle.mode}><option value="online">Online</option><option value="in_person">In person</option><option value="both">Online and in person</option></select></label>
            <label><span>Approximate area</span><input className="field" name="approximateArea" maxLength={80} defaultValue={management.circle.approximateArea ?? ''} /></label>
            <label className="circle-form-wide"><span>Rules</span><textarea className="field" name="rules" required defaultValue={management.circle.rules.join('\n')} /><small>Enter one rule per line.</small></label>
          </div>
          <div className="circle-form-actions"><button className="btn btn-self">Save settings</button></div>
        </form>
      </section>

      <section className="circle-manage-section" aria-labelledby="circle-privacy-title">
        <div className="circle-section-heading"><h2 id="circle-privacy-title">Privacy settings</h2><span>Host only</span></div>
        <p className="text-meta">These settings control who can find this Circle and what signed-in members can see before joining. Narrowing visibility never exposes past private content. Widening visibility applies to future reads only after you save.</p>
        <CirclePrivacyForm circleId={circleId} settings={management.circle.settings} onSave={(args) => act(() => updateSettings({ circleId, ...args }), 'Privacy settings saved.')} />
      </section>

      <CircleImageManage circleId={circleId} iconUrl={management.circle.iconUrl} coverUrl={management.circle.coverUrl} active={management.circle.state === 'active'} generateImageUploadUrl={generateImageUploadUrl} setImage={setImage} removeImage={removeImage} />

      <section className="circle-manage-section" aria-labelledby="circle-roles-title">
        <div className="circle-section-heading"><h2 id="circle-roles-title">Roles and ownership</h2><span>{management.activeMembers.length} active</span></div>
        {management.pendingTransfer && <div className="circle-pending-transfer"><p>Ownership offered to <strong>{management.pendingTransfer.displayName}</strong>.</p><button type="button" className="btn btn-neutral btn-sm" onClick={() => setConfirmation({ kind: 'cancel-transfer', displayName: management.pendingTransfer!.displayName })}>Cancel transfer</button></div>}
        <div className="circle-member-list">
          {management.activeMembers.filter((member) => member.role !== 'host').map((member) => (
            <article key={member.membershipId}>
              <div className="circle-role-initial" aria-hidden="true">{member.displayName.slice(0, 1).toUpperCase()}</div>
              <div><strong>{member.displayName}</strong><span>{member.username ? `@${member.username}` : 'Member'} · {member.role}</span></div>
              <div>
                {member.role === 'moderator' ? <button type="button" className="btn btn-neutral btn-sm" onClick={() => setConfirmation({ kind: 'revoke', membershipId: member.membershipId, displayName: member.displayName })}>Remove moderator</button> : <button type="button" className="btn btn-neutral btn-sm" disabled={!member.trustedRoleEligible || management.circle.state !== 'active'} title={!member.trustedRoleEligible ? 'Current identity verification is required' : undefined} onClick={() => void act(() => setModerator({ membershipId: member.membershipId, moderator: true }), 'Moderator role granted.')}>Make moderator</button>}
                <button type="button" className="btn btn-neutral btn-sm" disabled={!member.trustedRoleEligible || management.pendingTransfer !== null || management.circle.state !== 'active'} title={!member.trustedRoleEligible ? 'Current identity verification is required' : undefined} onClick={() => setConfirmation({ kind: 'transfer', userId: member.userId, displayName: member.displayName })}>Offer ownership</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="circle-manage-section" aria-labelledby="circle-bans-title">
        <div className="circle-section-heading"><h2 id="circle-bans-title">Banned members</h2><span>{management.bannedMembers.length}</span></div>
        {management.bannedMembers.length === 0 ? <div className="circle-state-card">No banned members.</div> : <div className="circle-member-list">{management.bannedMembers.map((member) => <article key={member.membershipId}><div className="circle-role-initial" aria-hidden="true">{member.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{member.displayName}</strong><span>{member.username ? `@${member.username}` : 'Member'}</span></div><div><button type="button" className="btn btn-neutral btn-sm" disabled={management.circle.state !== 'active'} onClick={() => setConfirmation({ kind: 'unban', membershipId: member.membershipId, displayName: member.displayName })}>Unban</button></div></article>)}</div>}
      </section>

      <section className="circle-manage-section circle-manage-danger" aria-labelledby="circle-lifecycle-title">
        <div><h2 id="circle-lifecycle-title">Circle availability</h2><p>{management.circle.state === 'archived' ? 'This Circle is read-only for its members.' : 'Archiving keeps discussions available to members in read-only mode.'}</p></div>
        <button type="button" className={management.circle.state === 'archived' ? 'btn btn-self' : 'btn btn-danger'} onClick={() => setConfirmation({ kind: 'lifecycle', state: management.circle.state === 'archived' ? 'active' : 'archived' })}>{management.circle.state === 'archived' ? 'Reactivate Circle' : 'Archive Circle'}</button>
      </section>
    </div>
  )
}

type CirclePrivacySettings = {
  discoverability: 'listed' | 'unlisted'
  discussionVisibility: 'members_only' | 'signed_in'
  memberListVisibility: 'members_only' | 'signed_in'
  joinPolicy: 'approval_required' | 'open'
  postApproval: 'off' | 'approval_required'
}

function CirclePrivacyForm({ circleId, settings, onSave }: {
  circleId: Id<'circles'>
  settings: CirclePrivacySettings
  onSave: (args: CirclePrivacySettings) => Promise<unknown>
}) {
  const [discussionVisibility, setDiscussionVisibility] = useState(settings.discussionVisibility)
  const [memberListVisibility, setMemberListVisibility] = useState(settings.memberListVisibility)
  const access = discussionVisibility === 'signed_in' && memberListVisibility === 'signed_in' ? 'public' : 'private'

  return (
    <form className="circle-manage-form" onSubmit={(event) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      void onSave({
        discoverability: String(data.get('discoverability') ?? 'listed') as 'listed' | 'unlisted',
        discussionVisibility,
        memberListVisibility,
        joinPolicy: String(data.get('joinPolicy') ?? 'approval_required') as 'approval_required' | 'open',
        postApproval: String(data.get('postApproval') ?? 'off') as 'off' | 'approval_required',
      })
    }}>
      <div className="circle-form-grid">
        <label className="circle-form-wide"><span>Circle access</span><select
          className="field"
          value={access}
          onChange={(event) => {
            const next = event.currentTarget.value as 'private' | 'public'
            setDiscussionVisibility(next === 'public' ? 'signed_in' : 'members_only')
            setMemberListVisibility(next === 'public' ? 'signed_in' : 'members_only')
          }}
        ><option value="private">Private</option><option value="public">Public</option></select><small>{access === 'public'
          ? 'Public Circles let signed-in members preview discussions, members, and events before joining. Posting stays members only.'
          : 'Private Circles show only purpose, host, and rules until someone joins.'}</small></label>
        <label><span>Discoverability</span><select className="field" name="discoverability" defaultValue={settings.discoverability}><option value="listed">Listed in Discover</option><option value="unlisted">Unlisted, direct link only</option></select><small>Listed Circles appear in Discover for signed-in members. Unlisted Circles stay reachable by direct link but never appear in Discover.</small></label>
        <label><span>Join policy</span><select className="field" name="joinPolicy" defaultValue={settings.joinPolicy}><option value="approval_required">Approval required</option><option value="open">Open, instant join</option></select><small>Approval keeps the request and host decision flow. Open admits an eligible member instantly after they acknowledge the rules. Banned members stay blocked either way, and archived Circles accept no new joins.</small></label>
        <label><span>Post approval</span><select className="field" name="postApproval" defaultValue={settings.postApproval ?? 'off'}><option value="off">Off, posts appear immediately</option><option value="approval_required">Leader approval required</option></select><small>When required, member posts stay hidden until a leader approves them. Approval posts them to the Circle immediately.</small></label>
        <label><span>Discussion visibility</span><select className="field" name="discussionVisibility" value={discussionVisibility} onChange={(event) => setDiscussionVisibility(event.currentTarget.value as 'members_only' | 'signed_in')}><option value="members_only">Active members only</option><option value="signed_in">Visible to signed-in members</option></select><small>Signed-in lets eligible members read discussions before joining. Only active members can post, react, comment, or moderate. Removed content stays hidden from everyone except moderators.</small></label>
        <label><span>Member list visibility</span><select className="field" name="memberListVisibility" value={memberListVisibility} onChange={(event) => setMemberListVisibility(event.currentTarget.value as 'members_only' | 'signed_in')}><option value="members_only">Active members only</option><option value="signed_in">Visible to signed-in members</option></select><small>Signed-in shows active member profiles and roles only. Requests, past members, bans, and moderation records are never shown in the member list.</small></label>
      </div>
      <div className="circle-form-actions"><button className="btn btn-self">Save privacy settings</button></div>
    </form>
  )
}

function CircleImageManage({ circleId, iconUrl, coverUrl, active, generateImageUploadUrl, setImage, removeImage }: {
  circleId: Id<'circles'>
  iconUrl?: string
  coverUrl?: string
  active: boolean
  generateImageUploadUrl: (args: { circleId: Id<'circles'>; kind: 'icon' | 'cover' }) => Promise<string>
  setImage: (args: { circleId: Id<'circles'>; kind: 'icon' | 'cover'; storageId: Id<'_storage'> }) => Promise<unknown>
  removeImage: (args: { circleId: Id<'circles'>; kind: 'icon' | 'cover' }) => Promise<unknown>
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [previews, setPreviews] = useState<{ icon?: string; cover?: string }>({})

  async function upload(kind: 'icon' | 'cover', file: File | null) {
    if (!file || file.size === 0 || busy) return
    setBusy(kind)
    setError('')
    try {
      const storageId = await uploadCircleImage(file, () => generateImageUploadUrl({ circleId, kind }))
      await setImage({ circleId, kind, storageId })
      setPreviews((current) => ({ ...current, [kind]: undefined }))
      toast.success(kind === 'icon' ? 'Circle icon updated.' : 'Circle cover updated.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Circle image could not be updated.')
    } finally {
      setBusy('')
    }
  }

  async function remove(kind: 'icon' | 'cover') {
    setBusy(`remove-${kind}`)
    setError('')
    try {
      await removeImage({ circleId, kind })
      toast.success(kind === 'icon' ? 'Circle icon removed.' : 'Circle cover removed.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Circle image could not be removed.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="circle-manage-section" aria-labelledby="circle-images-title">
      <div className="circle-section-heading"><h2 id="circle-images-title">Circle images</h2><span>Host only</span></div>
      <p className="text-meta">Static JPEG, PNG, or WebP still images, 5 MB or smaller. Images appear on the Circle page for anyone who can view it. Client cropping is not included yet, so choose a square image for the icon and a wide image for the cover.</p>
      {error && <p className="notice notice-danger" role="alert">{error}</p>}
      <div className="circle-image-grid">
        {(['icon', 'cover'] as const).map((kind) => {
          const current = kind === 'icon' ? iconUrl : coverUrl
          const preview = previews[kind]
          return (
            <article key={kind} className="circle-image-card">
              <h3>{kind === 'icon' ? 'Icon, square (1:1)' : 'Cover, wide (4:1)'}</h3>
              {preview
                ? <img className={kind === 'icon' ? 'circle-icon-preview' : 'circle-cover-preview'} src={preview} alt={`${kind} preview`} />
                : current
                  ? <img className={kind === 'icon' ? 'circle-icon-preview' : 'circle-cover-preview'} src={current} alt={`Current Circle ${kind}`} />
                  : <div className="circle-state-card">{kind === 'icon' ? 'No icon yet. The Circle marker is shown instead.' : 'No cover yet.'}</div>}
              <label className="field-row"><span className="label">{preview ? 'Preview selected. Upload to apply.' : 'Choose an image'}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={!active || Boolean(busy)} onChange={(event) => {
                const files = event.currentTarget.files
                const file = files?.item?.(0) ?? (files as unknown as Array<File>)?.[0] ?? null
                if (!file) return
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                  setError('Circle images must be JPEG, PNG, or WebP still images.')
                  return
                }
                if (file.size > 5 * 1024 * 1024) {
                  setError('Circle images must be 5 MB or smaller.')
                  return
                }
                setPreviews((currentPreviews) => ({ ...currentPreviews, [kind]: URL.createObjectURL(file) }))
                void upload(kind, file)
                event.currentTarget.value = ''
              }} /></label>
              {current && <button type="button" className="btn btn-ghost btn-sm" disabled={!active || Boolean(busy)} onClick={() => void remove(kind)}>{busy === `remove-${kind}` ? 'Removing...' : `Remove ${kind}`}</button>}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export async function uploadCircleImage(file: File, generateUploadUrl: () => Promise<string>): Promise<Id<'_storage'>> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Circle images must be JPEG, PNG, or WebP still images.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Circle images must be 5 MB or smaller.')
  const uploadUrl = await generateUploadUrl()
  const result = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
  if (!result.ok) throw new Error('Circle image upload failed.')
  const { storageId } = await result.json() as { storageId: string }
  return storageId as Id<'_storage'>
}

function CircleMembers({ circleId, canModerate }: { circleId: Id<'circles'>; canModerate: boolean }) {
  const members = useQuery(api.circles.members, { circleId })
  const requests = useQuery(api.circles.joinRequests, canModerate ? { circleId } : 'skip')
  const decide = useMutation(api.circles.decideJoinRequest)
  const moderate = useMutation(api.circles.moderateMember)
  const [error, setError] = useState('')
  const [moderationTarget, setModerationTarget] = useState<{
    membershipId: Id<'circleMemberships'>
    displayName: string
    action: 'remove' | 'ban'
  } | null>(null)
  const [rejectTarget, setRejectTarget] = useState<{ membershipId: Id<'circleMemberships'>; displayName: string } | null>(null)
  const act = async (callback: () => Promise<unknown>, message: string) => {
    try {
      setError('')
      await callback()
      toast.success(message)
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The member action could not be completed.')
      return false
    }
  }
  if (members === undefined) return <div className="circle-state-card" role="status">Loading members...</div>
  return (
    <div className="circle-members-layout">
      <ConfirmationDialog
        open={moderationTarget !== null}
        onClose={() => setModerationTarget(null)}
        onConfirm={async () => {
          if (!moderationTarget) return
          const completed = await act(
            () => moderate({ membershipId: moderationTarget.membershipId, action: moderationTarget.action }),
            moderationTarget.action === 'ban' ? 'Member banned.' : 'Member removed.',
          )
          if (completed) setModerationTarget(null)
        }}
        title={moderationTarget?.action === 'ban' ? `Ban ${moderationTarget.displayName}?` : `Remove ${moderationTarget?.displayName ?? 'this member'}?`}
        description={moderationTarget?.action === 'ban'
          ? `${moderationTarget.displayName} will lose access to this Circle and cannot request to rejoin.`
          : `${moderationTarget?.displayName ?? 'This member'} will lose access to this Circle. They can request to rejoin later.`}
        confirmLabel={moderationTarget?.action === 'ban' ? 'Ban member' : 'Remove member'}
      />
      <ConfirmationDialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onConfirm={async () => {
          if (!rejectTarget) return
          const completed = await act(
            () => decide({ membershipId: rejectTarget.membershipId, decision: 'reject' }),
            'Request rejected.',
          )
          if (completed) setRejectTarget(null)
        }}
        title={`Reject ${rejectTarget?.displayName ?? 'this member'}'s request?`}
        description={`${rejectTarget?.displayName ?? 'This member'} will not join this Circle. They can request to join again later.`}
        confirmLabel="Reject request"
      />
      {error && <p role="alert" className="notice notice-danger">{error}</p>}
      {canModerate && (
        <section aria-labelledby="join-queue-title">
          <div className="circle-section-heading"><h2 id="join-queue-title">Join requests</h2><span>{requests?.length ?? 0}</span></div>
          {requests === undefined ? <p role="status">Loading requests...</p> : requests.length === 0 ? <div className="circle-state-card">No pending requests.</div> : (
            <div className="circle-member-list">
              {requests.map((request) => (
                <article key={request.membershipId}>
                  <Avatar name={request.displayName} size="large" className="ds-post-avatar-image" />
                  <div><strong>{request.displayName}</strong><span>{request.username ? `@${request.username}` : 'Member'}</span></div>
                  <div>
                    <button className="btn btn-neutral btn-sm" onClick={() => void act(() => decide({ membershipId: request.membershipId, decision: 'approve' }), 'Member approved.')}>Approve</button>
                    <button className="btn btn-danger-quiet btn-sm" onClick={() => setRejectTarget({ membershipId: request.membershipId, displayName: request.displayName })}>Reject</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      <section aria-labelledby="circle-members-title">
        <div className="circle-section-heading"><h2 id="circle-members-title">Members</h2><span>{members.length}</span></div>
        <div className="circle-member-list">
          {members.map((member) => (
            <article key={member.userId}>
              <Avatar name={member.displayName} src={member.profileImageUrl} size="large" className="ds-post-avatar-image" />
              <div><strong>{member.displayName}</strong><span>{member.username ? `@${member.username}` : 'Member'} · {member.role}</span></div>
              {canModerate && member.role === 'member' && (
                <div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModerationTarget({ membershipId: member.membershipId, displayName: member.displayName, action: 'remove' })}><UserMinus size={14} aria-hidden="true" /> Remove</button>
                  <button className="btn btn-danger-quiet btn-sm" onClick={() => setModerationTarget({ membershipId: member.membershipId, displayName: member.displayName, action: 'ban' })}><Shield size={14} aria-hidden="true" /> Ban</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function CircleDiscussions({ detail, circleId, postId, commentId }: { detail: Exclude<NonNullable<ReturnType<typeof useQuery<typeof api.circles.detail>>>, { unavailable: true }>; circleId: Id<'circles'>; postId?: string; commentId?: string }) {
  const { results, status, loadMore } = usePaginatedQuery(api.social.circleFeed, { circleId }, { initialNumItems: 15 })
  const requested = useQuery(api.social.requestedPost, postId ? { postId } : 'skip') as CirclePost | null | undefined
  const setPostRemoved = useMutation(api.circles.setPostRemoved)
  const pinPost = useMutation(api.circles.pinPost)
  const unpinPost = useMutation(api.circles.unpinPost)
  const posts = useMemo(() => requested && !results.some((post) => post._id === requested._id) ? [requested, ...results] : results, [requested, results])

  useEffect(() => {
    if (!postId || !posts.some((post) => String(post._id) === postId)) return
    requestAnimationFrame(() => document.getElementById(`circle-post-${postId}`)?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
  }, [postId, posts])

  async function discussionAction(callback: () => Promise<unknown>, success?: string) {
    try {
      setError('')
      await callback()
      if (success) toast.success(success)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Circle action could not be completed.')
    }
  }

  return <div className="circle-discussion-stack">
    <CircleEventsCarousel circleId={circleId} canLead={detail.canModerate} />
    <div className={detail.canModerate ? 'circle-discussion-layout' : 'circle-discussion-layout circle-discussion-layout-single'}>
    <div className="circle-discussion-main">
      {detail.canWrite && <CircleComposer circleId={circleId} canModerate={detail.canModerate} />}
      {error && <p className="notice notice-danger" role="alert">{error}</p>}
      {status === 'LoadingFirstPage' ? <div className="circle-state-card" role="status">Loading discussions...</div> : posts.length === 0 ? <div className="circle-state-card"><strong>No discussions yet.</strong><p>Start with a question that gives people an easy way in.</p></div> : <div className="circle-post-list">{posts.map((post) => <CirclePostCard key={post._id} post={post} focused={String(post._id) === postId} focusCommentId={String(post._id) === postId ? commentId : undefined} canWrite={detail.canWrite} canModerate={detail.canModerate} pinned={detail.pinnedPostIds.some((id) => id === post._id)} onPin={() => detail.pinnedPostIds.some((id) => id === post._id) ? unpinPost({ circleId, postId: post._id }) : pinPost({ circleId, postId: post._id })} onRemove={() => setPostRemoved({ postId: post._id, removed: true })} />)}</div>}
      <InfiniteScrollTrigger
        status={status}
        onLoadMore={() => loadMore(15)}
        loadingLabel="Loading more discussions..."
        className="circle-load-more"
      />
    </div>
    {detail.canModerate && <CircleSideRail circleId={circleId} onModerationAction={discussionAction} />}
    </div>
  </div>
}

function CircleComposer({ circleId, canModerate }: { circleId: Id<'circles'>; canModerate: boolean }) {
  const createPost = useMutation(api.social.createPost)
  const mediaUsage = useQuery(api.social.mediaUploadUsage)
  const generatePostMediaUploadUrl = useMutation(api.social.generatePostMediaUploadUrl)
  const registerPostMediaUpload = useMutation(api.social.registerPostMediaUpload)
  const discardPostMediaUpload = useMutation(api.social.discardPostMediaUpload)
  const [body, setBody] = useState('')
  const [announcement, setAnnouncement] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const [pollDraft, setPollDraft] = useState<PollDraft>(emptyPollDraft)
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([])
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedMediaRef = useRef<SelectedMedia[]>([])
  const mediaLimit = mediaUsage?.limit ?? 5
  const remainingUploads = mediaUsage?.remaining ?? mediaLimit
  selectedMediaRef.current = selectedMedia

  useEffect(() => () => {
    selectedMediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
  }, [])

  function clearSelectedMedia() {
    selectedMedia.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    setSelectedMedia([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function addFiles(files: FileList | null) {
    if (!files) return
    setError('')
    const cap = Math.min(remainingUploads, MAX_CIRCLE_POST_MEDIA)
    const slots = Math.max(0, cap - selectedMedia.length)
    if (slots === 0) {
      setError(selectedMedia.length >= MAX_CIRCLE_POST_MEDIA ? 'Circle posts can include up to 3 media uploads.' : 'You have reached the daily media upload limit.')
      return
    }
    const accepted: SelectedMedia[] = []
    for (const file of Array.from(files)) {
      if (accepted.length >= slots) break
      const kind = mediaKind(file)
      if (!kind) { setError('Posts can include photos and video only.'); continue }
      if (kind === 'image' && file.size > 10 * 1024 * 1024) { setError('Photos must be 10 MB or smaller.'); continue }
      if (kind === 'video' && file.size > 50 * 1024 * 1024) { setError('Videos must be 50 MB or smaller.'); continue }
      accepted.push({ file, kind, previewUrl: URL.createObjectURL(file) })
    }
    if (Array.from(files).length > slots) {
      setError(selectedMedia.length + slots >= MAX_CIRCLE_POST_MEDIA
        ? 'Circle posts can include up to 3 media uploads.'
        : `You can add ${slots} more media upload${slots === 1 ? '' : 's'} before the daily limit.`)
    }
    setSelectedMedia((items) => [...items, ...accepted])
  }

  function removeSelectedMedia(index: number) {
    setSelectedMedia((items) => {
      const next = [...items]
      const [removed] = next.splice(index, 1)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return next
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const text = body.trim()
    if (!text && selectedMedia.length === 0 && !pollOpen) return
    const pollError = pollOpen ? pollValidationError(pollDraft) : null
    if (pollError) { setError(pollError); return }
    setPosting(true)
    setError('')
    let mediaUploadIds: Id<'postMediaUploads'>[] = []
    try {
      mediaUploadIds = await uploadPostMedia(selectedMedia, generatePostMediaUploadUrl, registerPostMediaUpload, discardPostMediaUpload)
      await createPost({
        body: text,
        circleId,
        circleKind: announcement ? 'announcement' : 'discussion',
        mediaUploadIds: mediaUploadIds.length > 0 ? mediaUploadIds : undefined,
        poll: pollOpen ? { question: pollDraft.question, options: pollDraft.options } : undefined,
      })
      setBody('')
      setPollOpen(false)
      setPollDraft(emptyPollDraft())
      clearSelectedMedia()
      toast.success(approvalNotice ? 'Sent for leader approval.' : announcement ? 'Announcement posted.' : 'Discussion posted.')
    } catch (cause) {
      await discardRegisteredUploads(mediaUploadIds, discardPostMediaUpload)
      setError(cause instanceof Error ? cause.message : 'The post could not be created.')
    } finally {
      setPosting(false)
    }
  }

  return <form className="circle-composer" onSubmit={(event) => void submit(event)}>
    <label htmlFor="circle-post-body">Start a conversation</label>
    <textarea id="circle-post-body" className="field" maxLength={1000} value={body} onChange={(event) => setBody(event.currentTarget.value)} placeholder="Share a thought or ask the Circle a question" />
    {canModerate && <label className="circle-rules-check"><input type="checkbox" checked={announcement} onChange={(event) => { setAnnouncement(event.currentTarget.checked); if (event.currentTarget.checked) setPollOpen(false) }} /><span>Post as an announcement</span></label>}
    {approvalNotice && <p className="text-meta">New posts need leader approval before they appear in the Circle.</p>}
    {selectedMedia.length > 0 && <PostMediaGrid mode="preview" media={selectedMedia} onRemove={removeSelectedMedia} />}
    {pollOpen && <PollComposer value={pollDraft} onChange={setPollDraft} disabled={posting} />}
    <div className="circle-composer-toolbar">
      <span className="text-meta tabular">{body.length}/1000 · {pollOpen ? 'Poll' : selectedMedia.length > 0 ? 'Media' : 'Text only'}</span>
      <div className="circle-composer-actions">
        <button type="button" className="social-icon-button" onClick={() => fileInputRef.current?.click()} disabled={pollOpen || posting || remainingUploads <= selectedMedia.length || selectedMedia.length >= MAX_CIRCLE_POST_MEDIA} aria-label="Add photos or video" title="Add photos or video"><ImagePlus size={18} /></button>
        <input ref={fileInputRef} className="social-file-input" type="file" accept="image/*,video/*" multiple onChange={(event) => addFiles(event.currentTarget.files)} />
        <span className="text-meta">{remainingUploads} of {mediaLimit} daily media uploads left</span>
        {!announcement && <button type="button" className="btn btn-neutral btn-sm" data-active={pollOpen} aria-pressed={pollOpen} onClick={() => { setPollOpen((open) => { if (!open) clearSelectedMedia(); return !open }); setError('') }}>{pollOpen ? 'Remove poll' : 'Add a poll'}</button>}
        <button className="btn btn-social" disabled={posting || (!body.trim() && selectedMedia.length === 0 && !pollOpen)}>{posting ? 'Posting...' : 'Post'}</button>
      </div>
    </div>
    {error && <p className="notice notice-danger" role="alert">{error}</p>}
  </form>
}

type CirclePinnedPost = NonNullable<FunctionReturnType<typeof api.circles.pinnedPosts>>[number]
type CircleEventItem = NonNullable<FunctionReturnType<typeof api.circleEvents.list>>[number]

function formatEventWhen(startsAt: number) {
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(startsAt)
}

function eventModeLabel(mode: CircleEventItem['mode']) {
  if (mode === 'online') return 'Online'
  if (mode === 'in_person') return 'In person'
  if (mode === 'both') return 'Online and in person'
  return null
}

function CircleRemovedContent({ circleId, onModerationAction }: { circleId: Id<'circles'>; onModerationAction: (callback: () => Promise<unknown>, success?: string) => Promise<void> }) {
  const removed = useQuery(api.circles.removedContent, { circleId })
  const setPostRemoved = useMutation(api.circles.setPostRemoved)
  const setCommentRemoved = useMutation(api.circles.setCommentRemoved)
  return (
    <section className="circle-moderation-queue" aria-labelledby="removed-content-title">
      <div className="circle-section-heading"><h2 id="removed-content-title">Removed content</h2><span>Leaders only</span></div>
      {removed === undefined
        ? <p role="status" className="text-meta">Loading moderation history...</p>
        : removed.length === 0
          ? <p className="text-meta">Nothing is waiting to be restored.</p>
          : removed.map((item) => (
            <article key={`${item.kind}-${item.id}`}>
              <span>{item.kind}</span>
              <p>{item.body}</p>
              <button className="btn btn-neutral btn-sm" onClick={() => void onModerationAction(() => item.kind === 'post' ? setPostRemoved({ postId: item.id, removed: false }) : setCommentRemoved({ commentId: item.id, removed: false }), `${item.kind === 'post' ? 'Post' : 'Comment'} restored.`)}>Restore</button>
            </article>
          ))}
    </section>
  )
}

function CirclePendingPosts({ circleId }: { circleId: Id<'circles'> }) {
  const pending = useQuery(api.circles.pendingCirclePosts, { circleId })
  const approve = useMutation(api.circles.approveCirclePost)
  const reject = useMutation(api.circles.rejectCirclePost)
  const [error, setError] = useState('')

  async function decide(kind: 'approve' | 'reject', postId: Id<'posts'>) {
    try {
      setError('')
      if (kind === 'approve') {
        await approve({ postId })
        toast.success('Post approved.')
      } else {
        await reject({ postId })
        toast.success('Post not approved.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The decision could not be saved.')
    }
  }

  if (pending === undefined) return <div className="circle-state-card" role="status">Loading posts waiting for approval...</div>
  return (
    <div className="circle-removed-panel">
      <div className="circle-section-heading"><h2>Pending posts</h2><span>{pending.length}</span></div>
      <p className="text-meta">New member posts stay hidden until a leader approves them. Approval posts them to the Circle immediately.</p>
      {error && <p className="notice notice-danger" role="alert">{error}</p>}
      {pending.length === 0 ? <div className="circle-state-card">No posts waiting for approval.</div> : (
        <div className="circle-post-list">{pending.map((post) => (
          <PostCard key={post._id} author={post.authorDisplayName} imageUrl={post.authorProfileImageUrl} timestamp={formatTime(post.createdAt)} dateTime={new Date(post.createdAt).toISOString()} className="circle-post-card"
            avatarAction={<Link to="/member-profile" search={{ userId: post.authorId }} className="social-post-avatar-link" aria-label={`View ${post.authorDisplayName}'s profile`}><Avatar name={post.authorDisplayName} src={post.authorProfileImageUrl} size="large" decorative /></Link>}
            actions={<div className="circle-post-tools"><button className="btn btn-social btn-sm" onClick={() => void decide('approve', post._id)}>Approve</button><button className="btn btn-danger-quiet btn-sm" onClick={() => void decide('reject', post._id)}>Reject</button></div>}>
            <p className="circle-post-body">{post.body}</p>
            {post.media.length > 0 && <PostMediaGrid media={post.media} />}
            {post.poll && <div className="circle-pending-poll"><strong>{post.poll.question}</strong><ul>{post.poll.options.map((option) => <li key={option.id}>{option.label}</li>)}</ul></div>}
          </PostCard>
        ))}</div>
      )}
    </div>
  )
}

function CircleEventsCarousel({ circleId, canLead }: { circleId: Id<'circles'>; canLead: boolean }) {
  const events = useQuery(api.circleEvents.list, { circleId })
  const setEventState = useMutation(api.circleEvents.setState)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CircleEventItem | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<CircleEventItem | null>(null)
  const [actionError, setActionError] = useState('')
  const trackRef = useRef<HTMLDivElement | null>(null)

  async function changeState(event: CircleEventItem, state: 'scheduled' | 'cancelled') {
    try {
      setActionError('')
      await setEventState({ eventId: event._id, state })
      toast.success(state === 'cancelled' ? 'Event cancelled.' : 'Event restored.')
      setConfirmCancel(null)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The event could not be updated.')
    }
  }

  function scrollTrack(direction: 1 | -1) {
    const track = trackRef.current
    if (!track) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollBy({ left: direction * Math.min(track.clientWidth * 0.8, 560), behavior: reduced ? 'auto' : 'smooth' })
  }

  if (events !== undefined && events.length === 0 && !canLead) return null

  return (
    <section className="circle-events-carousel" aria-labelledby="circle-events-title">
      <ConfirmationDialog open={confirmCancel !== null} onClose={() => setConfirmCancel(null)} onConfirm={() => { if (confirmCancel) void changeState(confirmCancel, 'cancelled') }} title={confirmCancel ? `Cancel ${confirmCancel.title}?` : 'Cancel this event?'} description="Members will still see the event marked as cancelled. You can restore it while its date is still in the future." confirmLabel="Cancel event" />
      <div className="circle-events-heading">
        <div className="circle-section-heading"><h2 id="circle-events-title">Upcoming events</h2><span className="tabular">{events ? events.length : ''}</span></div>
        {events && events.length > 1 && (
          <div className="circle-carousel-nav">
            <button type="button" className="icon-button" aria-label="Scroll events back" onClick={() => scrollTrack(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>
            <button type="button" className="icon-button" aria-label="Scroll events forward" onClick={() => scrollTrack(1)}><ChevronRight size={16} aria-hidden="true" /></button>
          </div>
        )}
      </div>
      {actionError && <p className="notice notice-danger" role="alert">{actionError}</p>}
      {events === undefined
        ? <p role="status" className="text-meta">Loading events...</p>
        : (
          <div className="circle-event-track" ref={trackRef} tabIndex={0} role="region" aria-label="Upcoming events list">
            {events.map((event) => (
              <article key={String(event._id)} className="circle-event-card" title={event.details}>
                {event.thumbnailUrl && <img className="circle-event-thumb" src={event.thumbnailUrl} alt="" aria-hidden="true" />}
                <div className="circle-event-copy">
                  <strong>{event.title}{event.state === 'cancelled' && <span className="status-pill" data-tone="warning">Cancelled</span>}</strong>
                  <span className="circle-event-when tabular"><time dateTime={new Date(event.startsAt).toISOString()}>{formatEventWhen(event.startsAt)}</time></span>
                  {(event.location || event.mode) && <span className="text-meta">{[event.location, eventModeLabel(event.mode)].filter(Boolean).join(' · ')}</span>}
                  {canLead && (
                    <div className="circle-event-actions">
                      {event.state === 'scheduled' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(event); setFormOpen(true) }}>Edit</button>}
                      {event.state === 'scheduled'
                        ? <button type="button" className="btn btn-danger-quiet btn-sm" onClick={() => setConfirmCancel(event)}>Cancel</button>
                        : <button type="button" className="btn btn-neutral btn-sm" onClick={() => void changeState(event, 'scheduled')}>Restore</button>}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {canLead && (
              <button type="button" className="circle-event-plan-tile" onClick={() => { setEditing(null); setFormOpen(true) }} aria-label="Plan event">
                <Plus size={18} aria-hidden="true" />
                <span>Plan event</span>
              </button>
            )}
          </div>
        )}
      {events !== undefined && events.length === 0 && canLead && !formOpen && (
        <p className="text-meta">No upcoming events yet. Plan the first one.</p>
      )}
      {canLead && formOpen && (
        <CircleEventForm
          circleId={circleId}
          initial={editing}
          onClose={() => { setFormOpen(false); setEditing(null) }}
          onSaved={() => { setFormOpen(false); setEditing(null) }}
        />
      )}
    </section>
  )
}

function toTimeInputValue(date: Date | null) {
  if (!date) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function CircleEventForm({ circleId, initial, onClose, onSaved }: {
  circleId: Id<'circles'>
  initial: CircleEventItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const generateUploadUrl = useMutation(api.circleEvents.generateThumbnailUploadUrl)
  const createEvent = useMutation(api.circleEvents.create)
  const updateEvent = useMutation(api.circleEvents.update)
  const removeThumbnail = useMutation(api.circleEvents.removeThumbnail)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [details, setDetails] = useState(initial?.details ?? '')
  const [day, setDay] = useState<Date | null>(() => (initial ? new Date(initial.startsAt) : null))
  const [time, setTime] = useState(() => (initial ? toTimeInputValue(new Date(initial.startsAt)) : ''))
  const [location, setLocation] = useState(initial?.location ?? '')
  const [mode, setMode] = useState<'online' | 'in_person' | 'both'>(initial?.mode ?? 'online')
  const [thumbnailStorageId, setThumbnailStorageId] = useState<Id<'_storage'> | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | undefined>(initial?.thumbnailUrl)
  const [thumbnailRemoved, setThumbnailRemoved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onThumbnailFile(file: File | null) {
    if (!file || file.size === 0 || busy) return
    setBusy(true)
    setError('')
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Event thumbnails must be JPEG, PNG, or WebP still images.')
      if (file.size > 5 * 1024 * 1024) throw new Error('Event thumbnails must be 5 MB or smaller.')
      const storageId = await uploadCircleImage(file, () => generateUploadUrl({ circleId }))
      setThumbnailStorageId(storageId)
      setThumbnailPreview(URL.createObjectURL(file))
      setThumbnailRemoved(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The event thumbnail could not be uploaded.')
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!day || !time || busy) return
    const [hours, minutes] = time.split(':').map(Number)
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      setError('Choose an event time.')
      return
    }
    const startsAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).getTime()
    setBusy(true)
    setError('')
    try {
      if (initial) {
        await updateEvent({
          eventId: initial._id,
          title: title.trim(),
          details: details.trim(),
          startsAt,
          location: location.trim() || undefined,
          mode,
          thumbnailStorageId: thumbnailStorageId ?? undefined,
        })
        if (thumbnailRemoved && !thumbnailStorageId) await removeThumbnail({ eventId: initial._id })
        toast.success('Event updated.')
      } else {
        await createEvent({
          circleId,
          title: title.trim(),
          details: details.trim(),
          startsAt,
          location: location.trim() || undefined,
          mode,
          thumbnailStorageId: thumbnailStorageId ?? undefined,
        })
        toast.success('Event planned.')
      }
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The event could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="circle-event-form" aria-label={initial ? 'Edit event' : 'Plan event'} onSubmit={(event) => void onSubmit(event)}>
      <h3>{initial ? 'Edit event' : 'Plan event'}</h3>
      {error && <p className="notice notice-danger" role="alert">{error}</p>}
      <label><span>Event title</span><input className="field" value={title} required maxLength={120} onChange={(event) => setTitle(event.currentTarget.value)} placeholder="Coffee crawl in Cebu City" /></label>
      <label><span>Event details</span><textarea className="field" value={details} required maxLength={2000} onChange={(event) => setDetails(event.currentTarget.value)} placeholder="Share the plan, what to bring, and how to find the group." /><small>Useful context helps members decide to come.</small></label>
      <div className="circle-event-datetime">
        <span className="label" id="circle-event-date-label">Date</span>
        <Calendar value={day} variant="social" aria-label="Event date" min={new Date()} onChange={setDay} />
        <label><span>Time</span><input className="field" type="time" required value={time} onChange={(event) => setTime(event.currentTarget.value)} /></label>
      </div>
      <label><span>Location</span><input className="field" value={location} maxLength={120} onChange={(event) => setLocation(event.currentTarget.value)} placeholder="Ayala Center Cebu, or online link" /><small>Use a public meeting place. Do not enter a home address.</small></label>
      <label><span>Mode</span><select className="field" value={mode} onChange={(event) => setMode(event.currentTarget.value as 'online' | 'in_person' | 'both')}><option value="online">Online</option><option value="in_person">In person</option><option value="both">Online and in person</option></select></label>
      <div className="circle-event-thumb-row">
        {thumbnailPreview
          ? <img className="circle-event-thumb-preview" src={thumbnailPreview} alt="Event thumbnail preview" />
          : <div className="circle-state-card">No thumbnail yet.</div>}
        <label className="field-row"><span className="label">Thumbnail</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => {
          const files = event.currentTarget.files
          const file = files?.item?.(0) ?? null
          void onThumbnailFile(file)
          event.currentTarget.value = ''
        }} /><small>Square JPEG, PNG, or WebP, 5 MB or smaller.</small></label>
        {initial?.thumbnailUrl && !thumbnailStorageId && !thumbnailRemoved && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setThumbnailRemoved(true)}>Remove thumbnail</button>
        )}
        {thumbnailRemoved && <p className="text-meta">The thumbnail will be removed when you save.</p>}
      </div>
      <div className="circle-form-actions">
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onClose}>Cancel</button>
        <button className="btn btn-social btn-sm" disabled={busy || !title.trim() || !details.trim() || !day || !time}>{busy ? 'Saving...' : initial ? 'Save event' : 'Create event'}</button>
      </div>
    </form>
  )
}

function CirclePostCard({ post, focused, focusCommentId, canWrite, canModerate, pinned, onPin, onRemove }: { post: CirclePost; focused: boolean; focusCommentId?: string; canWrite: boolean; canModerate: boolean; pinned: boolean; onPin: () => Promise<unknown>; onRemove: () => Promise<unknown> }) {
  const comments = useQuery(api.social.commentsForPost, { postId: post._id }) as CircleComment[] | undefined
  const createComment = useMutation(api.social.createComment)
  const toggleLike = useMutation(api.social.toggleLike)
  const toggleSave = useMutation(api.social.toggleSavePost)
  const toggleCommentLike = useMutation(api.social.toggleCommentLike)
  const voteOnPoll = useMutation(api.social.voteOnPoll)
  const report = useMutation(api.reports.create)
  const setCommentRemoved = useMutation(api.circles.setCommentRemoved)
  const [commentsOpen, setCommentsOpen] = useState(Boolean(focused))
  const [commentBody, setCommentBody] = useState('')
  const [replyTo, setReplyTo] = useState<Id<'postComments'> | undefined>()
  const [actionError, setActionError] = useState('')
  const [removeTarget, setRemoveTarget] = useState<
    { kind: 'post'; displayName: string }
    | { kind: 'comment'; commentId: Id<'postComments'>; displayName: string }
    | null
  >(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const pinnedMeta = pinned ? <><span aria-hidden="true">·</span><span><Pin size={12} aria-hidden="true" /> Pinned</span></> : null
  useEffect(() => { if (focused) setCommentsOpen(true) }, [focused])
  useEffect(() => { if (!focusCommentId || !comments?.some((comment) => String(comment._id) === focusCommentId)) return; requestAnimationFrame(() => document.getElementById(`circle-comment-${focusCommentId}`)?.focus()) }, [comments, focusCommentId])
  async function postAction(callback: () => Promise<unknown>, success?: string) {
    try {
      setActionError('')
      await callback()
      if (success) toast.success(success)
      return true
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The post action could not be completed.')
      return false
    }
  }
  return <><ConfirmationDialog open={removeTarget !== null} onClose={() => setRemoveTarget(null)} onConfirm={async () => { if (!removeTarget) return; const completed = await postAction(removeTarget.kind === 'post' ? onRemove : () => setCommentRemoved({ commentId: removeTarget.commentId, removed: true }), removeTarget.kind === 'post' ? 'Post removed.' : 'Comment removed.'); if (completed) setRemoveTarget(null) }} title={removeTarget?.kind === 'comment' ? `Remove ${removeTarget.displayName}'s comment?` : `Remove ${removeTarget?.displayName ?? 'this member'}'s post?`} description={removeTarget?.kind === 'comment' ? 'The comment will disappear from the discussion. A moderator can restore it from removed content.' : 'The post will disappear from the discussion. A moderator can restore it from removed content.'} confirmLabel={removeTarget?.kind === 'comment' ? 'Remove comment' : 'Remove post'} /><PostCard id={`circle-post-${post._id}`} tabIndex={focused ? -1 : undefined} avatarAction={<Link to="/member-profile" search={{ userId: post.authorId }} className="social-post-avatar-link" aria-label={`View ${post.authorDisplayName}'s profile`}><Avatar name={post.authorDisplayName} src={post.authorProfileImageUrl} size="large" decorative /></Link>} author={post.authorDisplayName} imageUrl={post.authorProfileImageUrl} timestamp={formatTime(post.createdAt)} dateTime={new Date(post.createdAt).toISOString()} className="circle-post-card" meta={<>{post.circleKind === 'announcement' && <span className="circle-announcement-label"><Check size={12} aria-hidden="true" /> Announcement</span>}{post.approvalState === 'pending' && <span className="status-pill">Waiting for leader approval</span>}{post.approvalState === 'rejected' && <span className="status-pill" data-tone="danger">Not approved</span>}{pinnedMeta}</>} actions={<div className="circle-post-tools">{canModerate && <ActionMenu label="Post options" items={[{ label: pinned ? 'Unpin post' : 'Pin post', icon: <Pin size={15} aria-hidden="true" />, onSelect: () => void postAction(onPin, pinned ? 'Post unpinned.' : 'Post pinned.') }, { label: 'Remove post', tone: 'danger', onSelect: () => setRemoveTarget({ kind: 'post', displayName: post.authorDisplayName }) }]} />} {!post.ownPost && <button className="icon-button" type="button" aria-label="Report post" onClick={() => void postAction(() => report({ targetType: 'post', targetId: post._id, reason: 'Post needs safety review' }), 'Post report sent to safety review.')}><Shield size={16} /></button>}</div>}><p className="circle-post-body">{post.body}</p>{post.media.length > 0 && <PostMediaGrid media={post.media} onOpenAt={setLightboxIndex} />}{post.poll && <PollCard poll={post.poll} disabled={!canWrite} onVote={async (optionId) => { await postAction(() => voteOnPoll({ postId: post._id, optionId })) }} />}{actionError && <p className="notice notice-danger" role="alert">{actionError}</p>}<PostActionBar liked={post.liked} likeCount={post.likeCount} commentCount={post.commentCount} saved={post.saved} commentsOpen={commentsOpen} likeDisabled={!canWrite} showSave={canWrite} onLike={() => void postAction(() => toggleLike({ postId: post._id }))} onToggleComments={() => setCommentsOpen((open) => !open)} onSave={() => void postAction(() => toggleSave({ postId: post._id }))} />{commentsOpen && <div className="circle-comments">{canWrite && <form onSubmit={(event) => { event.preventDefault(); const body = commentBody.trim(); if (!body) return; void postAction(() => createComment({ postId: post._id, body, parentCommentId: replyTo }).then(() => { setCommentBody(''); setReplyTo(undefined) })) }}><input className="field" aria-label={replyTo ? 'Write a reply' : 'Write a comment'} placeholder={replyTo ? 'Write a reply' : 'Add to the discussion'} value={commentBody} onChange={(event) => setCommentBody(event.currentTarget.value)} maxLength={500} /><button className="btn btn-social btn-sm">{replyTo ? 'Reply' : 'Comment'}</button></form>}{comments === undefined ? <p role="status" className="text-meta">Loading comments...</p> : comments.length === 0 ? <p className="text-meta">No comments yet.</p> : <div className="circle-comment-list">{comments.map((comment) => <article key={comment._id} id={`circle-comment-${comment._id}`} tabIndex={String(comment._id) === focusCommentId ? -1 : undefined} data-reply={Boolean(comment.parentCommentId)}><Link to="/member-profile" search={{ userId: comment.authorId }} className="social-comment-avatar-link" aria-label={`View ${comment.authorDisplayName}'s profile`}><Avatar name={comment.authorDisplayName} src={comment.authorProfileImageUrl} size="small" /></Link><div><strong>{comment.authorDisplayName}</strong><p>{comment.body}</p><div>{canWrite && <button className="circle-text-action" onClick={() => void postAction(() => toggleCommentLike({ commentId: comment._id }))}><Heart size={13} fill={comment.liked ? 'currentColor' : 'none'} /> {comment.likeCount || 'Like'}</button>}{canWrite && <button className="circle-text-action" onClick={() => { setReplyTo(comment._id); setCommentBody('') }}><MessageCircle size={13} /> Reply</button>}{!comment.ownComment && <button className="circle-text-action" onClick={() => void postAction(() => report({ targetType: 'comment', targetId: comment._id, reason: 'Comment needs safety review' }), 'Comment report sent to safety review.')}>Report</button>}{canModerate && <button className="circle-text-action circle-danger-action" onClick={() => setRemoveTarget({ kind: 'comment', commentId: comment._id, displayName: comment.authorDisplayName })}>Remove</button>}</div></div></article>)}</div>}</div>}</PostCard>{lightboxIndex !== null && post.media.length > 0 && <SocialLightbox open onClose={() => setLightboxIndex(null)} title={`Post by ${post.authorDisplayName}`} media={post.media.map((item, index) => ({ kind: item.kind, url: item.url, alt: `Image ${index + 1} shared in this post` }))} initialIndex={lightboxIndex} details={<div className="social-lightbox-post"><div className="social-lightbox-author"><Avatar name={post.authorDisplayName} src={post.authorProfileImageUrl} size="large" decorative /><div className="min-w-0"><div className="social-lightbox-author-name"><strong>{post.authorDisplayName}</strong></div><time className="text-meta" dateTime={new Date(post.createdAt).toISOString()}>{formatTime(post.createdAt)}</time></div></div>{post.body ? <p className="ds-post-copy">{post.body}</p> : null}{post.poll && <PollCard poll={post.poll} disabled={!canWrite} onVote={async (optionId) => { await postAction(() => voteOnPoll({ postId: post._id, optionId })) }} />}</div>} />}</>
}
