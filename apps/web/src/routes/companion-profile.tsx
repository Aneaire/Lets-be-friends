import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import { formatPhp } from '@lets-be-friends/shared'
import type { Id } from '../../convex/_generated/dataModel'
import { OpenableImage } from '../design-system/molecules/OpenableImage'
import { ProfileContentPanel } from '../features/profile/ProfileContentPanel'

export const Route = createFileRoute('/companion-profile')({
  validateSearch: (search: Record<string, unknown>): { companionProfileId?: string } => (
    typeof search.companionProfileId === 'string' ? { companionProfileId: search.companionProfileId } : {}
  ),
  component: CompanionProfilePage,
})

type CompanionProfile = NonNullable<ReturnType<typeof useQuery<typeof api.companions.getPublic>>>
type CompanionReview = NonNullable<ReturnType<typeof useQuery<typeof api.reviews.forCompanion>>>[number]
type CompanionPost = NonNullable<ReturnType<typeof useQuery<typeof api.social.byUser>>>[number]

function CompanionProfilePage() {
  const { companionProfileId } = Route.useSearch()
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const companion = useQuery(api.companions.getPublic, companionProfileId ? { companionProfileId: companionProfileId as Id<'companionProfiles'> } : 'skip') as CompanionProfile | null | undefined
  const reviews = useQuery(api.reviews.forCompanion, companionProfileId ? { companionProfileId: companionProfileId as Id<'companionProfiles'> } : 'skip') as CompanionReview[] | undefined
  const posts = useQuery(api.social.byUser, companion?.userId ? { userId: companion.userId } : 'skip') as CompanionPost[] | undefined
  const toggleSaveProfile = useMutation(api.companions.toggleSaveProfile)
  const toggleFollow = useMutation(api.social.toggleFollow)
  const toggleSaveReview = useMutation(api.reviews.toggleSave)
  const toggleLikeReview = useMutation(api.reviews.toggleLike)
  const createReviewComment = useMutation(api.reviews.createComment)
  const report = useMutation(api.reports.create)
  const startConversation = useMutation(api.conversations.start)
  const [notice, setNotice] = useState('')
  const [messageError, setMessageError] = useState('')
  const [startingMessage, setStartingMessage] = useState(false)

  if (!companionProfileId) {
    return (
      <main className="marketing-page">
        <h1 className="text-h1 mt-2">Choose someone from Explore first.</h1>
        <Link to="/discover" className="btn btn-social btn-sm mt-5">Explore people</Link>
      </main>
    )
  }

  if (companion === undefined) return <main className="marketing-page"><div className="empty-state">Loading profile...</div></main>
  if (companion === null) {
    return (
      <main className="marketing-page">
        <h1 className="text-h1 mt-2">Profile is not available.</h1>
        <p className="lede mt-2">This profile may still be in review or no longer be available.</p>
        <Link to="/discover" className="btn btn-neutral btn-sm mt-5">Back to Explore</Link>
      </main>
    )
  }

  return (
    <main className="profile-page companion-profile-page">
      {(notice || messageError) && (
        <div className={messageError ? 'notice notice-danger mb-6' : 'notice notice-success mb-6'}>
          <span className="notice-icon">{messageError ? '!' : '✓'}</span>
          <span>{messageError || notice}</span>
        </div>
      )}

      <section className="panel companion-profile-hero mb-8">
        <div className="companion-profile-overview">
          <div className="companion-profile-main">
            <div className="companion-profile-identity">
              <ProfilePhoto imageUrl={companion.profileImageUrl} name={companion.displayName} size="lg" />
              <div className="min-w-0">
                <p className="text-meta">Companion</p>
                <h1 className="text-h1 companion-profile-name">{companion.displayName}</h1>
                <div className="worklist-row-meta mt-1">
                  <span>{companion.city}</span>
                  <span className="dot" aria-hidden="true" />
                  <span>{formatMode(companion.mode)}</span>
                  <span className="dot" aria-hidden="true" />
                  <span>{companion.rating.toFixed(1)} from {companion.reviewCount} reviews</span>
                </div>
              </div>
            </div>
            <p className="companion-profile-intro">{companion.intro}</p>
            {companion.bio && <p className="companion-profile-bio">{companion.bio}</p>}
          </div>

          <aside className="companion-profile-decision" aria-label={`Plan with ${companion.displayName}`}>
            <div className="companion-profile-planline"><span>Help · Trust · Connection</span></div>
            <p className="companion-profile-trust">Identity checked and Companion profile reviewed.</p>
            {companion.hourlyRateCentavos !== undefined ? (
              <p className="companion-profile-rate">
                <span className="companion-profile-rate-label">Hourly rate</span>
                <strong className="tabular">{formatPhp(companion.hourlyRateCentavos)}</strong>
                <span>per hour. Your final booking total includes the service fee.</span>
              </p>
            ) : (
              <p className="text-meta">This legacy profile must set a listed hourly rate before receiving member-wallet booking requests.</p>
            )}
            <div className="companion-profile-actions">
              {companion.viewerBookingEligibility === 'own_profile' ? (
                <>
                  <span className="status-pill" data-tone="self">Your profile</span>
                  <Link to="/become-companion" className="btn btn-self btn-sm companion-profile-edit-action">Edit Companion profile</Link>
                </>
              ) : (
                <>
                  <CompanionBookingAction eligibility={companion.viewerBookingEligibility} companionProfileId={companion._id} bookable={companion.bookable} />
                  {isSignedIn ? (
                    <>
                      <button
                        type="button"
                        disabled={startingMessage}
                        onClick={async () => {
                          setStartingMessage(true)
                          setMessageError('')
                          try {
                            const conversationId = await startConversation({ otherUserId: companion.userId })
                            await navigate({ to: '/messages', search: { conversationId } })
                          } catch (error) {
                            setMessageError(error instanceof Error ? error.message : 'Conversation could not be opened.')
                            setStartingMessage(false)
                          }
                        }}
                        className="btn btn-social btn-sm"
                      >
                        {startingMessage ? 'Opening…' : 'Message'}
                      </button>
                      <button
                        onClick={async () => {
                          await toggleFollow({ userId: companion.userId })
                          setNotice(companion.following ? 'Member unfollowed.' : 'Member followed.')
                        }}
                        className="btn btn-social-quiet btn-sm"
                      >
                        {companion.following ? 'Following' : 'Follow'}
                      </button>
                      <button
                        onClick={async () => {
                          await toggleSaveProfile({ companionProfileId: companion._id })
                          setNotice(companion.saved ? 'Profile removed from saved.' : 'Profile saved.')
                        }}
                        className="btn btn-neutral btn-sm"
                      >
                        {companion.saved ? 'Saved profile' : 'Save profile'}
                      </button>
                      <button
                        onClick={async () => {
                          await report({ targetType: 'profile', targetId: companion._id, reason: 'Profile needs safety review' })
                          setNotice('Report sent to safety review.')
                        }}
                        className="btn btn-danger btn-sm"
                      >
                        Report
                      </button>
                    </>
                  ) : (
                    <SignInButton mode="modal">
                      <button className="btn btn-self btn-sm">Sign in to save</button>
                    </SignInButton>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>

        <div className="companion-profile-fit-grid">
          <div>
            <p className="eyebrow">Strengths</p>
            <h2 className="text-h3 mt-1">What {companion.firstName} can offer</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              {companion.strengths.map((strength) => <span key={strength} className="chip" data-selected="true">{strength}</span>)}
            </div>
          </div>
          <div>
            <p className="eyebrow">Everyday help and activities</p>
            <h2 className="text-h3 mt-1">What you could do together</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              {companion.categories.map((category) => <span key={category} className="chip">{category}</span>)}
            </div>
          </div>
          <div>
            <p className="eyebrow">Boundaries</p>
            <h2 className="text-h3 mt-1">What keeps it comfortable</h2>
            {companion.boundaries.length > 0 ? (
              <ul className="profile-boundary-list mt-3">
                {companion.boundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}
              </ul>
            ) : (
              <p className="text-meta mt-3">No additional boundaries listed.</p>
            )}
          </div>
        </div>
      </section>

      <ProfileContentPanel
        ownerName={companion.displayName}
        posts={posts}
        reviews={reviews}
        rating={companion.rating}
        reviewCount={companion.reviewCount}
        postsDescription={`Posts visible from ${companion.displayName}'s member profile.`}
        emptyPostsDescription="This member has not shared a post yet."
        emptyReviewsDescription="Reviews will appear here after members complete plans together."
        onLikeReview={isSignedIn ? (review) => toggleLikeReview({ reviewId: review._id as Id<'reviews'> }) : undefined}
        onCommentReview={isSignedIn ? (review, body) => createReviewComment({ reviewId: review._id as Id<'reviews'>, body }) : undefined}
        reviewAction={(review) => isSignedIn ? (
          <button
            type="button"
            onClick={async () => {
              await toggleSaveReview({ reviewId: review._id as Id<'reviews'> })
              setNotice(review.saved ? 'Rating removed from saved.' : 'Rating saved.')
            }}
            className="btn btn-neutral btn-sm"
          >
            {review.saved ? 'Saved rating' : 'Save rating'}
          </button>
        ) : null}
      />
    </main>
  )
}

function CompanionBookingAction({
  eligibility,
  companionProfileId,
  bookable,
}: {
  eligibility: 'eligible' | 'sign_in_required' | 'verification_required' | 'own_profile'
  companionProfileId: Id<'companionProfiles'>
  bookable: boolean
}) {
  if (!bookable) return <span className="status-pill" data-tone="warning">Rate not configured</span>

  if (eligibility === 'eligible') {
    return (
      <Link to="/app" search={{ companionProfileId }} className="btn btn-social btn-sm">
        Book a time
      </Link>
    )
  }

  if (eligibility === 'verification_required') {
    return (
      <Link
        to="/verify-identity"
        search={{ intent: 'member', returnTo: '/app' }}
        className="btn btn-self btn-sm"
      >
        Verify before booking
      </Link>
    )
  }

  return (
    <SignInButton mode="modal">
      <button type="button" className="btn btn-self btn-sm">Sign in to plan</button>
    </SignInButton>
  )
}

function ProfilePhoto({ imageUrl, name, size }: { imageUrl?: string; name: string; size?: 'lg' }) {
  const className = size === 'lg' ? 'profile-photo profile-photo-lg' : 'profile-photo'
  return (
    <span className={className} aria-hidden={imageUrl ? undefined : true}>
      {imageUrl ? <OpenableImage src={imageUrl} alt={`${name} profile photo`} /> : <span>{initials(name)}</span>}
    </span>
  )
}

function formatMode(mode: string) {
  if (mode === 'both') return 'Online and in-person'
  if (mode === 'in_person') return 'In-person'
  return 'Online'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
