import { mobileIdentityPresentation, type LatestIdentityVerification } from '@/features/verification/identityPresentation'

export type ProfileViewer = {
  displayName: string
  username?: string
  role: 'member' | 'companion' | 'reviewer' | 'admin'
  createdAt: number
  onboardingCompletedAt?: number
  profileImageUrl?: string | null
  verificationStatus: 'not_started' | 'pending' | 'approved' | 'rejected'
  identityEligible: boolean
  bio?: string | null
  onboardingCategories?: string[] | null
  approximateLatitude?: number | null
  approximateLongitude?: number | null
}

export type ProfileVerification = LatestIdentityVerification

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
  const status = mobileIdentityPresentation(viewer.verificationStatus, verification, viewer.identityEligible)
  return { label: status.label, detail: status.guidance }
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
