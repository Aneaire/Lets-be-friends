export type CircleMembershipState = 'active' | 'requested' | 'rejected' | 'removed' | 'left' | 'banned' | null

export function circleAccessPresentation(input: {
  unavailable: boolean
  membershipState?: CircleMembershipState
  circleState?: 'active' | 'archived' | 'suspended'
  canWrite?: boolean
}) {
  if (input.unavailable || input.circleState === 'suspended') return 'unavailable' as const
  if (input.membershipState !== 'active') return 'preview' as const
  if (input.circleState === 'archived' || !input.canWrite) return 'member_read_only' as const
  return 'member_writable' as const
}

export function canRequestCircleMembership(state: CircleMembershipState) {
  return state === null || state === 'left' || state === 'removed' || state === 'rejected'
}

export type CirclePrivacySettings = {
  discoverability: 'listed' | 'unlisted'
  discussionVisibility: 'members_only' | 'signed_in'
  memberListVisibility: 'members_only' | 'signed_in'
  joinPolicy: 'approval_required' | 'open'
}

export function resolveCirclePrivacySettings(settings?: Partial<CirclePrivacySettings> | null): CirclePrivacySettings {
  return {
    discoverability: settings?.discoverability ?? 'listed',
    discussionVisibility: settings?.discussionVisibility ?? 'members_only',
    memberListVisibility: settings?.memberListVisibility ?? 'members_only',
    joinPolicy: settings?.joinPolicy ?? 'approval_required',
  }
}

export function circlePreviewSections(access: { canReadDiscussion?: boolean | null; canReadMembers?: boolean | null }) {
  // Server flags are authoritative. Preview sections mount only when the
  // backend grants the read. Local membership or visibility settings must
  // never re-derive this decision, so a stale or ineligible client cannot
  // mount a protected query the server would reject.
  return {
    showDiscussions: access.canReadDiscussion === true,
    showMembers: access.canReadMembers === true,
  }
}

export function previewDiscussionItems<T>(loaded: T[]): T[] {
  // The preview renders every loaded discussion result. Pagination owns
  // windowing through loadMore, so the view must never truncate the page
  // and silently drop later-page results.
  return [...loaded]
}

export function circleJoinLabel(joinPolicy?: 'approval_required' | 'open' | null, membershipState?: CircleMembershipState) {
  if (joinPolicy === 'open') return membershipState ? 'Join Circle again' : 'Join Circle'
  return membershipState === 'rejected' || membershipState === 'removed' || membershipState === 'left' ? 'Request to join again' : 'Request to join'
}

export function circlePrivacySummary(settings?: Partial<CirclePrivacySettings> | null) {
  const resolved = resolveCirclePrivacySettings(settings)
  return {
    discoverability: resolved.discoverability === 'unlisted'
      ? 'Unlisted. This Circle is reachable only by direct link.'
      : 'Listed. Signed-in members can find this Circle in Discover.',
    discussion: resolved.discussionVisibility === 'signed_in'
      ? 'Discussions are visible to signed-in members. Join to post, react, or comment.'
      : 'Discussions are visible to active members only.',
    memberList: resolved.memberListVisibility === 'signed_in'
      ? 'The member list is visible to signed-in members.'
      : 'The member list is visible to active members only.',
    join: resolved.joinPolicy === 'open'
      ? 'This Circle admits new members instantly after they acknowledge the rules.'
      : 'A host or moderator reviews each join request.',
  }
}

export function circleMembershipMessage(state: CircleMembershipState) {
  switch (state) {
    case 'requested': return 'Your request is waiting for a host or moderator.'
    case 'rejected': return 'Your earlier request was not approved. You can request to join again.'
    case 'removed': return 'Your membership ended. You can request to join again.'
    case 'banned': return 'You cannot request access to this Circle.'
    default: return undefined
  }
}

export function circleNotificationRoute(destination: { type: string; circleId?: string; postId?: string; commentId?: string }) {
  if (destination.type !== 'circle' || !destination.circleId) return undefined
  return {
    pathname: '/circles/[id]' as const,
    params: {
      id: destination.circleId,
      ...(destination.postId ? { postId: destination.postId } : {}),
      ...(destination.commentId ? { commentId: destination.commentId } : {}),
    },
  }
}

export function circleIndexPresentation<Mine extends { _id: string; membershipState?: string }, Discovery extends { _id: string }>(mine: Mine[] | undefined, discover: Discovery[] | undefined) {
  const mineRows = mine ?? []
  const joinedIds = new Set(mineRows.map((circle) => String(circle._id)))
  return {
    loading: mine === undefined || discover === undefined,
    mine: mineRows,
    activeHome: mineRows.filter((circle) => circle.membershipState === 'active').slice(0, 3),
    available: (discover ?? []).filter((circle) => !joinedIds.has(String(circle._id))),
  }
}

export function shouldQueryRemovedCircleContent(state: 'active' | 'archived' | 'suspended' | undefined) {
  return state === 'active'
}

export function circleActionError(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

export type CircleEventMode = 'online' | 'in_person' | 'both'
export type CircleEventState = 'scheduled' | 'cancelled'

export type CircleEventItem = {
  _id: string
  title: string
  details: string
  startsAt: number
  location?: string
  mode?: CircleEventMode
  state: CircleEventState
  thumbnailUrl?: string
  organizerDisplayName: string
}

export const MAX_CIRCLE_EVENT_TITLE_LENGTH = 120
export const MAX_CIRCLE_EVENT_DETAILS_LENGTH = 2000
export const MAX_CIRCLE_EVENT_LOCATION_LENGTH = 120
export const MAX_CIRCLE_EVENT_THUMBNAIL_BYTES = 5 * 1024 * 1024
export const supportedCircleEventThumbnailTypes = ['image/jpeg', 'image/png', 'image/webp'] as const

export function circleEventModeLabel(mode: CircleEventMode | undefined | null) {
  if (mode === 'online') return 'Online'
  if (mode === 'in_person') return 'In person'
  if (mode === 'both') return 'Online and in person'
  return null
}

export function formatCircleEventWhen(startsAt: number) {
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(startsAt)
}

export function circleEventLocationLine(event: Pick<CircleEventItem, 'location' | 'mode'>) {
  return [event.location, circleEventModeLabel(event.mode)].filter(Boolean).join(' · ') || undefined
}

export function validateCircleEventDraft(input: { title: string; details: string; startsAt: number | null | undefined; location?: string }) {
  const title = input.title.trim()
  const details = input.details.trim()
  const location = input.location?.trim() || undefined
  if (!title || !details) return 'Event title and details are required.'
  if (title.length > MAX_CIRCLE_EVENT_TITLE_LENGTH || details.length > MAX_CIRCLE_EVENT_DETAILS_LENGTH) return 'Event details are too long.'
  if (location && (location.length > MAX_CIRCLE_EVENT_LOCATION_LENGTH || /[\r\n]/.test(location))) return 'Use a short, single-line event location.'
  if (!Number.isFinite(input.startsAt) || (input.startsAt as number) <= Date.now()) return 'Event date and time must be in the future.'
  return null
}

export function canManageCircleEvents(input: { canModerate?: boolean; circleState?: 'active' | 'archived' | 'suspended' }) {
  return input.canModerate === true && input.circleState !== 'archived' && input.circleState !== 'suspended'
}

export function shouldQueryCircleEvents(canReadDiscussion?: boolean | null) {
  return canReadDiscussion === true
}

export function groupCircleEventsByDay<TEvent extends { _id: string; startsAt: number }>(events: TEvent[]) {
  const ordered = [...events].sort((left, right) => left.startsAt - right.startsAt)
  const groups: Array<{ key: string; label: string; events: TEvent[] }> = []
  for (const event of ordered) {
    const date = new Date(event.startsAt)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const label = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(date)
    const group = groups.find((row) => row.key === key)
    if (group) group.events.push(event)
    else groups.push({ key, label, events: [event] })
  }
  return groups
}

export function validateCircleEventThumbnailAsset(asset: { type?: string | null; mimeType?: string | null; fileName?: string | null; uri?: string; fileSize?: number }) {
  if (asset.type && asset.type !== 'image') {
    return { ok: false as const, message: 'Choose a still image for the event thumbnail.' }
  }
  const normalized = asset.mimeType?.trim().toLowerCase()
  const extension = (asset.fileName || asset.uri || '').split(/[?#]/)[0].split('.').pop()?.toLowerCase()
  const contentType = normalized && (supportedCircleEventThumbnailTypes as readonly string[]).includes(normalized)
    ? normalized
    : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : null
  if (!contentType) {
    return { ok: false as const, message: 'Event thumbnails must be JPEG, PNG, or WebP still images.' }
  }
  if (asset.fileSize !== undefined && (!Number.isSafeInteger(asset.fileSize) || asset.fileSize <= 0 || asset.fileSize > MAX_CIRCLE_EVENT_THUMBNAIL_BYTES)) {
    return { ok: false as const, message: 'Event thumbnails must be 5 MB or smaller.' }
  }
  return { ok: true as const, contentType }
}

export type CirclePreviewCardView = {
  _id: string
  name: string
  purpose: string
  category: string
  memberCount: number
  mode: 'online' | 'in_person' | 'both'
  approximateArea?: string
  hostDisplayName?: string | null
  joinPolicy?: 'approval_required' | 'open' | null
  circleState?: string | null
}

export function circlePreviewCardSummary(circle: CirclePreviewCardView) {
  const location = circle.approximateArea ?? (circle.mode === 'online' ? 'Online' : 'Area shared in Circle')
  return {
    location,
    meta: `${circle.category} · ${circle.memberCount} ${circle.memberCount === 1 ? 'member' : 'members'} · ${location}`,
    hostLine: `Hosted by ${circle.hostDisplayName ?? 'Circle host'}`,
    openJoin: circle.joinPolicy === 'open',
    archived: circle.circleState === 'archived',
  }
}

export function pinnedPostItems<TPost extends { _id: string }>(posts: TPost[]) {
  return [...posts]
}

export function canModeratePinnedPosts(input: { canModerate?: boolean; circleState?: 'active' | 'archived' | 'suspended' }) {
  return input.canModerate === true && input.circleState !== 'suspended'
}
