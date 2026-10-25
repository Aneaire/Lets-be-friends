import { buildProfileScreenModel } from '@/member/profileScreenModel'

function viewer(overrides: Record<string, unknown> = {}) {
  return {
    displayName: 'Alex Rivera',
    username: 'alexrivera',
    role: 'member',
    createdAt: Date.UTC(2026, 2, 1),
    onboardingCompletedAt: Date.UTC(2026, 2, 2),
    profileImageUrl: 'https://example.com/photo.jpg',
    verificationStatus: 'approved',
    identityEligible: true,
    bio: 'Coffee enthusiast and weekend hiker.',
    onboardingCategories: ['Hiking', 'Languages'],
    approximateLatitude: 14.5042,
    approximateLongitude: 121.0212,
    ...overrides,
  } as never
}

const approvedVerification = {
  adminStatus: 'approved',
  personaStatus: 'completed',
  identityStage: 'approved',
} as never

function application(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'cp-1',
    status: 'approved',
    intro: 'I can join a museum visit or help with everyday errands.',
    categories: ['Museums'],
    strengths: ['Conversation'],
    boundaries: ['Public places only'],
    mode: 'both',
    city: 'Cebu City',
    hourlyRateCentavos: 50000,
    rating: 4.8,
    reviewCount: 12,
    ...overrides,
  } as never
}

describe('profile screen model', () => {
  it('mirrors the web hero, status, and public Companion profile when approved', () => {
    const model = buildProfileScreenModel({
      viewer: viewer(),
      verification: approvedVerification,
      application: application(),
      posts: [],
      reviews: [],
    })

    expect(model.displayName).toBe('Alex Rivera')
    expect(model.username).toBe('@alexrivera')
    expect(model.bio).toBe('Coffee enthusiast and weekend hiker.')
    expect(model.interests).toEqual(['Hiking', 'Languages'])
    expect(model.memberSince).toBe('Member since March 2026')
    expect(model.verificationApproved).toBe(true)
    expect(model.verificationAction).toBe('none')
    expect(model.discoveryArea).toBe('14.5042, 121.0212')
    expect(model.hasApplication).toBe(true)
    expect(model.fullyVerified).toBe(true)
    expect(model.companion?.publicProfileId).toBe('cp-1')
    expect(model.companion?.categories).toEqual(['Museums'])
    expect(model.rating).toBe(4.8)
    expect(model.reviewCount).toBe(12)
    expect(model.reviewsStatus).toBe('empty')
  })

  it('hides the public profile without current identity approval', () => {
    const model = buildProfileScreenModel({
      viewer: viewer({ identityEligible: false, verificationStatus: 'pending' }),
      verification: { adminStatus: 'pending' } as never,
      application: application(),
      posts: undefined,
      reviews: undefined,
    })

    expect(model.companion?.publicProfileId).toBeNull()
    expect(model.fullyVerified).toBe(false)
    expect(model.verificationApproved).toBe(false)
    expect(model.verificationAction).toBe('none')
  })

  it('replaces the username placeholder and reports needs_companion without an application', () => {
    const model = buildProfileScreenModel({
      viewer: viewer({ username: undefined, verificationStatus: 'not_started', identityEligible: false }),
      verification: null,
      application: null,
      posts: [{ _id: 'post-1', authorId: 'user-a', body: 'Hello', createdAt: 1 }] as never,
      reviews: undefined,
    })

    expect(model.username).toBe('')
    expect(model.companion).toBeNull()
    expect(model.hasApplication).toBe(false)
    expect(model.verificationAction).toBe('verify')
    expect(model.discoveryArea).toBe('14.5042, 121.0212')
    expect(model.reviewsStatus).toBe('needs_companion')
    expect(model.reviews).toBeUndefined()
    expect(model.posts).toHaveLength(1)
  })

  it('reports ready reviews only for an approved Companion profile', () => {
    const reviews = [{ _id: 'review-1', rating: 5, body: 'Kind and punctual.' }] as never
    const ready = buildProfileScreenModel({
      viewer: viewer(),
      verification: approvedVerification,
      application: application(),
      posts: [],
      reviews,
    })
    expect(ready.reviewsStatus).toBe('ready')
    expect(ready.reviews).toHaveLength(1)

    const pending = buildProfileScreenModel({
      viewer: viewer(),
      verification: approvedVerification,
      application: application({ status: 'pending_review' }),
      posts: [],
      reviews,
    })
    expect(pending.reviewsStatus).toBe('needs_companion')
    expect(pending.companion?.publicProfileId).toBeNull()
  })
})
