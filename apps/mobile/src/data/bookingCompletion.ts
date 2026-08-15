import type { BookingStatus } from '@lets-be-friends/shared'

export function bookingCompletionCopy({
  status,
  pricingModel,
  requestedAt,
  durationMinutes,
  now = Date.now(),
  viewerRole,
  participantCompletedAt,
  otherParticipantCompletedAt,
  evidenceReady,
}: {
  status: BookingStatus
  pricingModel?: string
  requestedAt?: number
  durationMinutes?: number
  now?: number
  viewerRole: 'member' | 'companion'
  participantCompletedAt?: number
  otherParticipantCompletedAt?: number
  evidenceReady: boolean
}) {
  if (participantCompletedAt) {
    return {
      actionable: false,
      label: otherParticipantCompletedAt ? 'Completion confirmed by both people' : 'Waiting for the other person',
      detail: otherParticipantCompletedAt
        ? 'Both people confirmed the experience. The review and settlement lifecycle is now controlled by the server.'
        : `You confirmed completion as the ${viewerRole === 'member' ? 'member' : 'Companion'}. The other person still needs to confirm.`,
    }
  }
  if (status !== 'accepted') {
    return { actionable: false, label: 'Completion is not available', detail: 'Only an accepted booking can be confirmed complete.' }
  }

  if (
    typeof requestedAt !== 'number'
    || !Number.isFinite(requestedAt)
    || !Number.isSafeInteger(requestedAt)
    || typeof durationMinutes !== 'number'
    || !Number.isFinite(durationMinutes)
    || !Number.isSafeInteger(durationMinutes)
    || durationMinutes <= 0
  ) {
    return {
      actionable: false,
      label: 'Booking schedule needs attention',
      detail: 'Completion is unavailable because the scheduled session end could not be verified. Refresh the booking or contact support.',
    }
  }
  const durationMs = durationMinutes * 60_000
  const scheduledEndAt = requestedAt + durationMs
  if (!Number.isSafeInteger(durationMs) || !Number.isFinite(scheduledEndAt) || !Number.isSafeInteger(scheduledEndAt)) {
    return {
      actionable: false,
      label: 'Booking schedule needs attention',
      detail: 'Completion is unavailable because the scheduled session end could not be verified. Refresh the booking or contact support.',
    }
  }
  if (!Number.isFinite(now) || now < scheduledEndAt) {
    return {
      actionable: false,
      label: 'Available after the scheduled session ends',
      detail: 'Completion becomes available after the listed session duration. The server checks the schedule again when you confirm.',
    }
  }
  if (pricingModel === 'member_wallet_v2' && !evidenceReady) {
    return {
      actionable: false,
      label: 'Choose an evidence option first',
      detail: viewerRole === 'member'
        ? 'Upload end evidence or explicitly skip it before confirming completion.'
        : 'Upload start evidence or explicitly skip it before confirming completion.',
    }
  }
  return {
    actionable: true,
    label: 'Confirm experience completed',
    detail: 'Confirm only after the experience has ended. The server records your participant confirmation and waits for the other person.',
  }
}
