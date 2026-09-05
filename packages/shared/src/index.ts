export * from './feed'
export * from './finance'
export * from './discovery'
export * from './mentions'
export * from './map'
export * from './username'

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
  'Cleaning and tidying',
  'Deep cleaning',
  'Kitchen cleaning',
  'Bathroom cleaning',
  'Laundry and ironing',
  'Cooking and meal preparation',
  'Grocery shopping',
  'Shopping and errands',
  'Home organization',
  'Decluttering',
  'Packing and unpacking',
  'Moving and lifting',
  'Furniture assembly',
  'Minor home repairs',
  'Plumbing help',
  'Electrical help',
  'Painting and decorating',
  'Appliance installation',
  'Gardening and yard work',
  'Car and motorcycle washing',
  'Childcare',
  'Senior assistance',
  'Disability support',
  'Pet care',
  'Dog walking',
  'House sitting',
  'Tech help',
  'Phone and computer help',
  'Transportation',
  'Delivery and pickup',
  'Appointment companion',
  'Travel companion',
  'Events and celebrations',
  'Party preparation',
  'Study and coworking',
  'Tutoring and learning',
  'Language exchange',
  'Arts and crafts',
  'Photography and photo walks',
  'Fitness and sports',
  'Games and esports',
  'Nature and outdoors',
  'Explore the city',
  'Hobbies and skills',
  'Music and entertainment',
  'Friendly conversation',
  'Emotional support',
  'Community volunteering',
  'Religious and community activities',
] as const

export const allActivityCategoryLabel = 'Everything'
export const maximumActivityCategoryLength = 60
export const maximumCompanionActivityCategories = 10
export const maximumOnboardingActivityCategories = 6

export function normalizeActivityCategory(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  return activityCategories.find((category) => category.toLocaleLowerCase() === normalized.toLocaleLowerCase()) ?? normalized
}

export function activityCategoryValidationError(value: string) {
  const normalized = normalizeActivityCategory(value)
  if (!normalized) return 'Enter a category.'
  if (normalized.length > maximumActivityCategoryLength) {
    return `Categories must be ${maximumActivityCategoryLength} characters or fewer.`
  }
  if (normalized.toLocaleLowerCase() === allActivityCategoryLabel.toLocaleLowerCase()) {
    return `${allActivityCategoryLabel} is a filter and cannot be saved as a category.`
  }
  if (/\p{Cc}/u.test(normalized)) return 'Category contains unsupported characters.'
  return null
}

export function validateActivityCategories(values: readonly string[], maximum: number = maximumCompanionActivityCategories):
  | { ok: true; value: string[] }
  | { ok: false; message: string } {
  if (values.length > maximum) return { ok: false, message: `Choose up to ${maximum} categories.` }
  const normalized: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const error = activityCategoryValidationError(value)
    if (error) return { ok: false, message: error }
    const category = normalizeActivityCategory(value)
    const key = category.toLocaleLowerCase()
    if (seen.has(key)) return { ok: false, message: 'Choose each category only once.' }
    seen.add(key)
    normalized.push(category)
  }
  return { ok: true, value: normalized }
}

export function activityCategoryOptions(...categoryLists: ReadonlyArray<readonly string[] | null | undefined>) {
  const options: string[] = []
  const seen = new Set<string>()
  for (const value of [...activityCategories, ...categoryLists.flatMap((values) => values ?? [])]) {
    if (activityCategoryValidationError(value)) continue
    const normalized = normalizeActivityCategory(value)
    const key = normalized.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    options.push(normalized)
  }
  return options
}

export function activityCategoriesMatch(left: string, right: string) {
  return normalizeActivityCategory(left).toLocaleLowerCase() === normalizeActivityCategory(right).toLocaleLowerCase()
}

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
export const identityCheckReasons = ['member', 'booking', 'companion_application', 'reverification'] as const
export const userRoles = ['member', 'companion', 'reviewer', 'admin'] as const
export const companionApplicationStatuses = ['draft', 'pending_review', 'approved', 'rejected', 'suspended'] as const
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
export type DefaultActivityCategory = (typeof activityCategories)[number]
export type ActivityCategory = string
export type BookingStatus = (typeof bookingStatuses)[number]
export type VerificationStatus = (typeof verificationStatuses)[number]
export type VerificationRequestReason = (typeof identityCheckReasons)[number]
export type BookingEligibility = 'eligible' | 'sign_in_required' | 'verification_required' | 'own_profile'
export type UserRole = (typeof userRoles)[number]
export type CompanionApplicationStatus = (typeof companionApplicationStatuses)[number]
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
  companionOwnerUserId: string,
  identityEligible: boolean,
): BookingEligibility {
  if (viewerUserId == null) return 'sign_in_required'
  if (viewerUserId === companionOwnerUserId) return 'own_profile'
  return identityEligible ? 'eligible' : 'verification_required'
}

export function canBookCompanion(viewerUserId: string | null | undefined, companionOwnerUserId: string) {
  return viewerUserId == null || viewerUserId !== companionOwnerUserId
}

export function isAdminRole(role: UserRole) {
  return role === 'admin' || role === 'reviewer'
}

export function isModerationVisible(item: { hidden?: boolean }) {
  return item.hidden !== true
}
