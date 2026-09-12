export type GatheringMode = 'online' | 'in_person'
export type GatheringState = 'open' | 'closed' | 'cancelled'
export type GatheringParticipantState = 'requested' | 'confirmed' | 'declined' | 'removed' | 'left'

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
