export * from './feed'
export * from './finance'

export const friendStrengths = [
  'Good listener',
  'Local tour buddy',
  'Coffee companion',
  'Language practice',
  'Study partner',
  'Fitness buddy',
  'Gaming teammate',
  'Food trip companion',
  'Event buddy',
  'Photography walk partner',
  'Online chat friend',
  'Hobby mentor',
] as const

export const activityCategories = [
  'Good company',
  'Coffee and meals',
  'Explore the city',
  'Events and celebrations',
  'Games and esports',
  'Study and coworking',
  'Language exchange',
  'Arts and crafts',
  'Photo walks',
  'Fitness and sports',
  'Nature and outdoors',
  'Hobbies and skills',
  'Shopping and errands',
  'Tech help',
] as const

export const bookingStatuses = [
  'draft',
  'verification_required',
  'pending_admin_review',
  'request_sent',
  'accepted',
  'declined',
  'cancelled',
  'completed',
  'review_window',
  'closed',
] as const

export const verificationStatuses = ['not_started', 'pending', 'approved', 'rejected'] as const
export const verificationRequestReasons = ['member', 'booking', 'host_application', 'reverification'] as const
export const userRoles = ['member', 'friend_host', 'reviewer', 'admin'] as const
export const hostApplicationStatuses = ['draft', 'pending_review', 'approved', 'rejected', 'suspended'] as const
export const reportStatuses = ['open', 'reviewing', 'resolved', 'dismissed'] as const

export const brandAccentColors = {
  self: {
    name: 'logo blue',
    hex: '#1093ED',
    oklch: 'oklch(64.58% 0.1673 247.38)',
  },
  social: {
    name: 'logo pink',
    hex: '#C1519C',
    oklch: 'oklch(60.29% 0.1669 342.36)',
  },
} as const

export type FriendStrength = (typeof friendStrengths)[number]
export type ActivityCategory = (typeof activityCategories)[number]
export type BookingStatus = (typeof bookingStatuses)[number]
export type VerificationStatus = (typeof verificationStatuses)[number]
export type VerificationRequestReason = (typeof verificationRequestReasons)[number]
export type BookingEligibility = 'eligible' | 'sign_in_required' | 'verification_required' | 'own_profile'
export type UserRole = (typeof userRoles)[number]
export type HostApplicationStatus = (typeof hostApplicationStatuses)[number]
export type ReportStatus = (typeof reportStatuses)[number]
export type BrandAccentIntent = keyof typeof brandAccentColors

export function canBookingChat(status: BookingStatus) {
  return ['request_sent', 'accepted', 'completed', 'review_window'].includes(status)
}

export function canReadBookingMessages(status: BookingStatus) {
  return ['request_sent', 'accepted', 'declined', 'cancelled', 'completed', 'review_window', 'closed'].includes(status)
}

export function canCancelBooking(status: BookingStatus) {
  return ['verification_required', 'request_sent', 'accepted'].includes(status)
}

export function canCompleteBooking(status: BookingStatus) {
  return status === 'accepted'
}

export function canReviewBooking(status: BookingStatus) {
  return status === 'completed' || status === 'review_window'
}

export function bookingStatusAfterReview(otherParticipantHasReviewed: boolean): BookingStatus {
  return otherParticipantHasReviewed ? 'closed' : 'review_window'
}

export function canCreateBooking(_status: VerificationStatus, identityEligible: boolean) {
  return identityEligible
}

export function requiresVerificationForBooking(status: VerificationStatus, identityEligible: boolean) {
  return !canCreateBooking(status, identityEligible)
}

export function isMemberVerificationReason(reason: VerificationRequestReason) {
  return reason === 'member' || reason === 'reverification' || reason === 'booking'
}

export function bookingEligibility(
  viewerUserId: string | null | undefined,
  _verificationStatus: VerificationStatus | null | undefined,
  hostOwnerUserId: string,
  identityEligible: boolean,
): BookingEligibility {
  if (viewerUserId == null) return 'sign_in_required'
  if (viewerUserId === hostOwnerUserId) return 'own_profile'
  return identityEligible ? 'eligible' : 'verification_required'
}

export function canBookHost(viewerUserId: string | null | undefined, hostOwnerUserId: string) {
  return viewerUserId == null || viewerUserId !== hostOwnerUserId
}

export function isAdminRole(role: UserRole) {
  return role === 'admin' || role === 'reviewer'
}

export function isModerationVisible(item: { hidden?: boolean }) {
  return item.hidden !== true
}
