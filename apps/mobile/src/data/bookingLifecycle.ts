import { canCancelBooking, type BookingStatus } from '@lets-be-friends/shared'

export type BookingViewerRole = 'member' | 'companion'
export type BookingSettlementState = 'unreserved' | 'reserved' | 'pending' | 'blocked' | 'settled' | 'refunded'

export type BookingLifecycleInput = {
  status: BookingStatus
  viewerRole: BookingViewerRole
  memberId: string
  companionUserId?: string
  memberDisplayName?: string
  companionDisplayName?: string
  memberCompletedAt?: number
  companionCompletedAt?: number
  cancelledByUserId?: string
  cancelledAt?: number
  cancellationReason?: string
  settlementState?: BookingSettlementState
  settlementEligibleAt?: number
  settlementBlockedAt?: number
  settlementResolvedAt?: number
  settlementResolution?: 'released' | 'returned_to_member'
}

export function bookingActionVisibility({
  status,
  viewerRole,
  memberCompletedAt,
  companionCompletedAt,
  settlementState,
}: Pick<BookingLifecycleInput, 'status' | 'viewerRole' | 'memberCompletedAt' | 'companionCompletedAt' | 'settlementState'>) {
  const completionStarted = memberCompletedAt !== undefined || companionCompletedAt !== undefined
  return {
    canEditRequest: viewerRole === 'member' && status === 'request_sent' && !completionStarted,
    canCancel: canCancelBooking(status) && !completionStarted && settlementState !== 'blocked',
  }
}

export function validateCancellationReason(reason: string) {
  const trimmed = reason.trim()
  if (trimmed.length > 1_000) return { ok: false as const, message: 'Cancellation reason can be up to 1,000 characters.' }
  return { ok: true as const, reason: trimmed || undefined }
}

export function bookingLifecyclePresentation(input: BookingLifecycleInput) {
  const cancellation = input.cancelledAt === undefined && !input.cancellationReason && !input.cancelledByUserId
    ? undefined
    : {
        actor: cancellationActor(input),
        time: input.cancelledAt === undefined ? undefined : formatLifecycleTimestamp(input.cancelledAt),
        reason: input.cancellationReason?.trim() || undefined,
      }

  return {
    cancellation,
    completion: {
      member: completionValue(input.memberCompletedAt),
      companion: completionValue(input.companionCompletedAt),
    },
    settlement: input.settlementState === undefined ? undefined : settlementPresentation(input),
  }
}

function cancellationActor(input: BookingLifecycleInput) {
  if (!input.cancelledByUserId) return undefined
  if (input.cancelledByUserId === input.memberId) {
    return input.viewerRole === 'member' ? 'You (member)' : (input.memberDisplayName ?? 'Member')
  }
  if (input.companionUserId && input.cancelledByUserId === input.companionUserId) {
    return input.viewerRole === 'companion' ? 'You (Companion)' : (input.companionDisplayName ?? 'Companion')
  }
  return 'A booking participant'
}

function completionValue(timestamp: number | undefined) {
  return timestamp === undefined ? 'Not confirmed' : `Confirmed ${formatLifecycleTimestamp(timestamp)}`
}

function settlementPresentation(input: BookingLifecycleInput) {
  const resolvedAt = input.settlementResolvedAt === undefined ? undefined : formatLifecycleTimestamp(input.settlementResolvedAt)
  const eligibleAt = input.settlementEligibleAt === undefined ? undefined : formatLifecycleTimestamp(input.settlementEligibleAt)

  switch (input.settlementState) {
    case 'unreserved':
      return {
        label: 'Not reserved',
        explanation: 'No funds are reserved from the member booking wallet for this booking.',
        eligibleAt,
        resolvedAt,
      }
    case 'reserved':
      return {
        label: 'Reserved in member booking wallet',
        explanation: 'The booking total is reserved in the member booking wallet. No Companion amount is externally withdrawable.',
        eligibleAt,
        resolvedAt,
      }
    case 'pending':
      return {
        label: 'Pending settlement',
        explanation: 'The Companion amount is pending inside the app wallet lifecycle. It is not an external payout and is not externally withdrawable.',
        eligibleAt,
        resolvedAt,
      }
    case 'blocked':
      return {
        label: 'Blocked for admin resolution',
        explanation: 'Booking funds are held because a safety or settlement review needs admin resolution. Participants cannot release, return, or settle these funds.',
        eligibleAt,
        blockedAt: input.settlementBlockedAt === undefined ? undefined : formatLifecycleTimestamp(input.settlementBlockedAt),
        resolvedAt,
      }
    case 'settled':
      return {
        label: 'Settled to Companion earnings wallet',
        explanation: input.settlementResolution === 'released'
          ? 'Admin resolution released the Companion amount to the Companion earnings wallet. This is not an external payout or withdrawal.'
          : 'The Companion amount is recorded in the Companion earnings wallet. This is not an external payout or withdrawal.',
        eligibleAt,
        resolvedAt,
      }
    case 'refunded':
      return {
        label: 'Returned to member booking wallet',
        explanation: 'The booking funds were returned to the member booking wallet. This is not a PayMongo, card, bank, or other external refund.',
        eligibleAt,
        resolvedAt,
      }
  }
}

export function formatLifecycleTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}
