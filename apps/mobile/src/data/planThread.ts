import type { BookingStatus } from '@lets-be-friends/shared'

export type PlanThreadStep = {
  key: 'request' | 'confirmed' | 'experience' | 'completion' | 'review'
  title: string
  detail: string
  state: 'done' | 'current' | 'upcoming' | 'stopped'
}

export function buildPlanThread(input: {
  status: BookingStatus
  requestedAt: number
  memberCompletedAt?: number
  companionCompletedAt?: number
}): PlanThreadStep[] {
  const cancelled = input.status === 'cancelled' || input.status === 'declined'
  const accepted = ['accepted', 'completed', 'review_window', 'closed'].includes(input.status)
  const experiencePassed = input.status === 'completed' || input.status === 'review_window' || input.status === 'closed' || input.memberCompletedAt !== undefined || input.companionCompletedAt !== undefined
  const jointlyCompleted = input.memberCompletedAt !== undefined && input.companionCompletedAt !== undefined
  const reviewOpen = input.status === 'review_window' || input.status === 'closed'

  return [
    { key: 'request', title: 'Request shared', detail: 'Schedule, format, and expectations are visible to both people.', state: 'done' },
    { key: 'confirmed', title: cancelled ? 'Plan ended' : 'Plan confirmed', detail: cancelled ? `This plan was ${input.status}. Existing messages and safety records remain available.` : accepted ? 'The Companion accepted the plan.' : 'Waiting for the Companion to respond.', state: cancelled ? 'stopped' : accepted ? 'done' : 'current' },
    { key: 'experience', title: 'Experience', detail: `Planned for ${formatPlanDate(input.requestedAt)}.`, state: cancelled ? 'stopped' : experiencePassed ? 'done' : accepted ? 'current' : 'upcoming' },
    { key: 'completion', title: 'Completion check', detail: jointlyCompleted ? 'Both people confirmed completion.' : 'Each person confirms completion separately.', state: cancelled ? 'stopped' : jointlyCompleted ? 'done' : experiencePassed ? 'current' : 'upcoming' },
    { key: 'review', title: 'Reflection', detail: reviewOpen ? 'The review window is open.' : 'Reviews open after both completion checks.', state: cancelled ? 'stopped' : reviewOpen ? 'current' : 'upcoming' },
  ]
}

function formatPlanDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(timestamp)
}
