import { ownReviewsUiStatus, type MemberPost } from './memberContent'
import { buildSignedInProfileViewModel, type ProfileVerification, type ProfileViewer } from './profileViewModel'
import { companionIsPublic, formatDiscoveryArea, verificationActionFor } from './profileSections'

export type ProfileScreenApplication = {
  _id: string
  status: string
  intro: string
  categories?: string[] | null
  strengths?: string[] | null
  boundaries?: string[] | null
  mode: string
  city?: string | null
  hourlyRateCentavos?: number | null
  rating?: number | null
  reviewCount?: number | null
} | null

/**
 * Pure model behind the native Profile tab, mirroring web profile.tsx.
 * Display-name fallback, username placeholder, verification copy, discovery
 * area, Companion details, and the posts/reviews adapters all resolve here so
 * the screen stays a thin query wrapper and the mapping is unit-testable.
 */
export function buildProfileScreenModel(input: {
  viewer: ProfileViewer
  verification: ProfileVerification
  application: ProfileScreenApplication | undefined
  posts: MemberPost[] | undefined
  reviews: Array<{ _id: string; [key: string]: unknown }> | undefined
}) {
  const profile = buildSignedInProfileViewModel(input.viewer, input.verification)
  const verificationAction = verificationActionFor(input.viewer.verificationStatus, input.verification, profile.verificationApproved)
  const discoveryArea = formatDiscoveryArea(input.viewer.approximateLatitude, input.viewer.approximateLongitude)
  const application = input.application ?? null
  const publicProfile = application !== null && companionIsPublic(application.status, input.viewer.identityEligible)
  const reviewsStatus = ownReviewsUiStatus(application, input.reviews)
  return {
    displayName: profile.name,
    username: profile.username === 'Username not chosen' ? '' : profile.username,
    bio: input.viewer.bio ?? '',
    imageUrl: profile.imageUrl,
    interests: input.viewer.onboardingCategories ?? [],
    memberSince: profile.memberSince,
    roleLabel: profile.role,
    verificationLabel: profile.verificationLabel,
    verificationDetail: profile.verificationDetail,
    verificationApproved: profile.verificationApproved,
    verificationAction,
    discoveryArea,
    companion: application ? {
      status: application.status,
      intro: application.intro,
      categories: application.categories ?? [],
      strengths: application.strengths ?? [],
      boundaries: Array.isArray(application.boundaries) ? application.boundaries : [],
      mode: application.mode,
      city: application.city ?? null,
      hourlyRateCentavos: typeof application.hourlyRateCentavos === 'number' ? application.hourlyRateCentavos : null,
      rating: application.rating ?? null,
      reviewCount: application.reviewCount ?? null,
      publicProfileId: publicProfile ? String(application._id) : null,
    } : null,
    hasApplication: Boolean(application),
    fullyVerified: profile.verificationApproved && Boolean(application) && application?.status !== 'draft',
    posts: input.posts,
    reviews: reviewsStatus === 'ready' ? (input.reviews ?? []) : undefined,
    reviewsStatus,
    rating: application?.rating ?? null,
    reviewCount: application?.reviewCount ?? null,
  }
}
