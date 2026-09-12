export type GatheringMode = 'online' | 'in_person'
export type GatheringState = 'open' | 'closed' | 'cancelled'
export type GatheringParticipantState = 'requested' | 'confirmed' | 'declined' | 'removed' | 'left'

export type GatheringViewer = {
  isHost: boolean
  isCompanion: boolean
  participantState: GatheringParticipantState | null
  canRequestJoin: boolean
  canConfirm: boolean
}

export type GatheringSummaryLike = {
  _id: string
  category: string
  state: GatheringState
  startsAt: number
  durationMinutes: number
  capacity: number
  confirmedCount: number
  viewer: GatheringViewer
}

export function formatGatheringWhen(startsAt: number) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(startsAt)
}

export function formatGatheringDuration(minutes: number) {
  const hours = minutes / 60
  if (minutes % 60 === 0) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${minutes} minutes`
}

export function gatheringModeLabel(mode: GatheringMode) {
  return mode === 'in_person' ? 'In person' : 'Online session'
}

export function gatheringStateLabel(state: GatheringState) {
  if (state === 'cancelled') return 'Cancelled'
  if (state === 'closed') return 'Closed'
  return 'Open'
}

export function gatheringParticipantStateLabel(state: GatheringParticipantState) {
  if (state === 'confirmed') return 'Confirmed'
  if (state === 'requested') return 'Requested'
  if (state === 'declined') return 'Not confirmed'
  if (state === 'removed') return 'Removed'
  return 'Left'
}

export function gatheringSeatLabel(confirmedCount: number, capacity: number) {
  const remaining = Math.max(0, capacity - confirmedCount)
  if (remaining === 0) return 'Full'
  return `${remaining} ${remaining === 1 ? 'seat' : 'seats'} left`
}

export function gatheringIndexPresentation<T extends GatheringSummaryLike>(mine: T[] | undefined) {
  const rows = Array.isArray(mine) ? mine : []
  return {
    loading: mine === undefined,
    hosting: rows.filter((row) => row.viewer.isHost),
    joined: rows.filter((row) => !row.viewer.isHost),
  }
}

export function gatheringStatusCopy(viewer: GatheringViewer) {
  if (viewer.isHost) return 'You are hosting this Gathering.'
  if (viewer.isCompanion) return 'You are the Companion for this Gathering.'
  switch (viewer.participantState) {
    case 'confirmed': return 'Your seat is confirmed.'
    case 'requested': return 'Your request is waiting for the host.'
    case 'declined': return 'The host did not confirm your request.'
    case 'removed': return 'The host removed you from this Gathering.'
    case 'left': return 'You left this Gathering.'
    default: return null
  }
}

export function canRequestGathering(viewer: GatheringViewer, state: GatheringState) {
  return state === 'open' && viewer.canRequestJoin
}

export function canLeaveGathering(viewer: GatheringViewer) {
  return !viewer.isHost && !viewer.isCompanion && (viewer.participantState === 'requested' || viewer.participantState === 'confirmed')
}

export function gatheringAudienceOptions(circleId?: string) {
  return [
    { value: 'none' as const, label: 'Do not post an Invite' },
    { value: 'profile' as const, label: 'My profile' },
    ...(circleId ? [{ value: circleId, label: 'This Circle' }] : []),
  ]
}
