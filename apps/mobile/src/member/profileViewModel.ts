export type ProfileViewer = {
  displayName: string
  username?: string
  role: 'member' | 'companion' | 'reviewer' | 'admin'
  createdAt: number
  onboardingCompletedAt?: number
  profileImageUrl?: string | null
  verificationStatus: 'not_started' | 'pending' | 'approved' | 'rejected'
  identityEligible: boolean
}

export type ProfileVerification = {
  adminStatus: 'not_ready' | 'pending' | 'approved' | 'rejected' | 'not_started'
  personaStatus: string
  identityStage?: string
} | null

export type ProfileViewModel = {
  name: string
  username: string
  role: string
  memberSince: string
  imageUrl?: string
  verificationLabel: string
  verificationDetail: string
  verificationApproved: boolean
  onboardingLabel: string
  onboardingComplete: boolean
}

export function buildSignedInProfileViewModel(
  viewer: ProfileViewer,
  verification: ProfileVerification,
): ProfileViewModel {
  const onboardingComplete = Boolean(viewer.username && viewer.onboardingCompletedAt)
  const verificationState = verificationCopy(viewer, verification)

  return {
    name: viewer.displayName.trim() || 'New friend',
    username: viewer.username ? `@${viewer.username}` : 'Username not chosen',
    role: roleLabel(viewer.role),
    memberSince: `Member since ${formatMonthYear(viewer.createdAt)}`,
    imageUrl: viewer.profileImageUrl || undefined,
    verificationLabel: verificationState.label,
    verificationDetail: verificationState.detail,
    verificationApproved: viewer.identityEligible,
    onboardingLabel: onboardingComplete ? 'Welcome guide complete' : 'Welcome guide needs attention',
    onboardingComplete,
  }
}

function verificationCopy(viewer: ProfileViewer, verification: ProfileVerification) {
  if (viewer.identityEligible) {
    return {
      label: 'Identity verified',
      detail: 'Your current identity approval is active for member booking.',
    }
  }
  if (viewer.verificationStatus === 'rejected' || verification?.adminStatus === 'rejected') {
    return {
      label: 'Identity not approved',
      detail: 'The latest identity review was not approved. No active verification is claimed.',
    }
  }
  if (verification?.adminStatus === 'not_ready') {
    return {
      label: 'Identity status unavailable',
      detail: 'Your identity status cannot be confirmed right now. Please try again later.',
    }
  }
  if (
    viewer.verificationStatus === 'pending'
    || verification?.adminStatus === 'pending'
    || ['created', 'in_progress', 'processing', 'completed', 'pending'].includes(verification?.personaStatus ?? '')
    || ['extracting', 'confirmation_required', 'ready_for_review'].includes(verification?.identityStage ?? '')
  ) {
    return {
      label: 'Identity review pending',
      detail: 'Your latest identity check is still in progress and is not approved yet.',
    }
  }
  return {
    label: 'Identity not verified',
    detail: 'No active identity approval is recorded for this account.',
  }
}

function roleLabel(role: ProfileViewer['role']) {
  if (role === 'companion') return 'Companion'
  if (role === 'reviewer') return 'Reviewer'
  if (role === 'admin') return 'Admin'
  return 'Member'
}

function formatMonthYear(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(timestamp))
}
