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
