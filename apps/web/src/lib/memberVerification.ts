export type MemberVerificationStatus = 'not_started' | 'pending' | 'approved' | 'rejected'

export type MemberVerificationPresentation = {
  state: 'not_started' | 'pending' | 'approved' | 'rejected'
  label: string
  tone: 'self' | 'success' | 'warning' | 'danger'
  guidance: string
}

export function memberVerificationPresentation(
  status: MemberVerificationStatus,
  latestRequestStatus?: MemberVerificationStatus | null,
): MemberVerificationPresentation {
  if (status === 'approved') {
    return {
      state: 'approved',
      label: 'Verified',
      tone: 'success',
      guidance: 'Your identity review is approved. You can request bookings with Friend Hosts.',
    }
  }

  if (status === 'pending' || latestRequestStatus === 'pending') {
    return {
      state: 'pending',
      label: 'Pending review',
      tone: 'warning',
      guidance: 'Manual identity review is in progress. No action is needed while the safety team reviews it.',
    }
  }

  if (status === 'rejected' || latestRequestStatus === 'rejected') {
    return {
      state: 'rejected',
      label: 'Not approved',
      tone: 'danger',
      guidance: 'Your identity review was not approved. You can request another review before booking.',
    }
  }

  return {
    state: 'not_started',
    label: 'Not started',
    tone: 'self',
    guidance: 'Request identity review before booking a Friend Host.',
  }
}
