import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import { formatPhp } from '@lets-be-friends/shared'
import type { Id } from '../../convex/_generated/dataModel'
import { MeetingSeam } from '../components/AppNavigation'

export const Route = createFileRoute('/host-profile')({
  validateSearch: (search: Record<string, unknown>): { hostProfileId?: string } => (
    typeof search.hostProfileId === 'string' ? { hostProfileId: search.hostProfileId } : {}
  ),
  component: HostProfilePage,
})

type HostProfile = NonNullable<ReturnType<typeof useQuery<typeof api.hosts.getPublic>>>
type HostReview = NonNullable<ReturnType<typeof useQuery<typeof api.reviews.forHost>>>[number]
type HostPost = NonNullable<ReturnType<typeof useQuery<typeof api.social.byUser>>>[number]
type HostPostMedia = { storageId: Id<'_storage'>; kind: 'image' | 'video'; url: string | null }

function HostProfilePage() {
  const { hostProfileId } = Route.useSearch()
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const host = useQuery(api.hosts.getPublic, hostProfileId ? { hostProfileId: hostProfileId as Id<'hostProfiles'> } : 'skip') as HostProfile | null | undefined
  const reviews = useQuery(api.reviews.forHost, hostProfileId ? { hostProfileId: hostProfileId as Id<'hostProfiles'> } : 'skip') as HostReview[] | undefined
  const posts = useQuery(api.social.byUser, host?.userId ? { userId: host.userId } : 'skip') as HostPost[] | undefined
  const toggleSaveProfile = useMutation(api.hosts.toggleSaveProfile)
  const toggleFollow = useMutation(api.social.toggleFollow)
  const toggleSaveReview = useMutation(api.reviews.toggleSave)
  const report = useMutation(api.reports.create)
  const startConversation = useMutation(api.conversations.start)
  const [notice, setNotice] = useState('')
  const [messageError, setMessageError] = useState('')
  const [startingMessage, setStartingMessage] = useState(false)

  if (!hostProfileId) {
    return (
      <main className="marketing-page">
        <h1 className="text-h1 mt-2">Choose someone from Explore first.</h1>
        <Link to="/discover" className="btn btn-social btn-sm mt-5">Explore people</Link>
      </main>
    )
  }

  if (host === undefined) return <main className="marketing-page"><div className="empty-state">Loading profile...</div></main>
  if (host === null) {
    return (
      <main className="marketing-page">
        <h1 className="text-h1 mt-2">Profile is not available.</h1>
        <p className="lede mt-2">This profile may still be in review or no longer be available.</p>
        <Link to="/discover" className="btn btn-neutral btn-sm mt-5">Back to Explore</Link>
      </main>
    )
  }

  return (
    <main className="marketing-page-wide host-profile-page">
      {(notice || messageError) && (
        <div className={messageError ? 'notice notice-danger mb-6' : 'notice notice-success mb-6'}>
          <span className="notice-icon">{messageError ? '!' : '✓'}</span>
          <span>{messageError || notice}</span>
        </div>
      )}

      <section className="panel host-profile-hero mb-8">
        <div className="host-profile-overview">
          <div className="host-profile-main">
            <div className="host-profile-identity">
              <ProfilePhoto imageUrl={host.profileImageUrl} name={host.displayName} size="lg" />
              <div className="min-w-0">
                <p className="text-meta">Friend Host</p>
                <h1 className="text-h1">{host.displayName}</h1>
                <div className="worklist-row-meta mt-1">
                  <span>{host.city}</span>
                  <span className="dot" aria-hidden="true" />
                  <span>{formatMode(host.mode)}</span>
                  <span className="dot" aria-hidden="true" />
                  <span>{host.rating.toFixed(1)} from {host.reviewCount} reviews</span>
                </div>
              </div>
            </div>
            {host.bio && <p className="host-profile-bio">{host.bio}</p>}
            <p className="host-profile-intro">{host.intro}</p>
          </div>

          <aside className="host-profile-decision" aria-label={`Plan with ${host.displayName}`}>
            <div className="host-profile-planline"><MeetingSeam /><span>Fit · Trust · Shared plan</span></div>
            <p className="host-profile-trust">Identity checked and Friend Host profile reviewed.</p>
            {host.hourlyRateCentavos !== undefined ? (
              <p className="host-profile-rate">
                <strong className="tabular">{formatPhp(host.hourlyRateCentavos)}</strong>
                <span>per hour. Your final booking total includes the service fee.</span>
              </p>
            ) : (
              <p className="text-meta">This legacy profile must set a listed hourly rate before receiving member-wallet booking requests.</p>
            )}
            <div className="host-profile-actions">
              {host.viewerBookingEligibility === 'own_profile' ? (
                <>
                  <span className="status-pill" data-tone="self">Your profile</span>
                  <Link to="/become-host" className="btn btn-self btn-sm">Edit hosting profile</Link>
                </>
              ) : (
                <>
                  <HostBookingAction eligibility={host.viewerBookingEligibility} hostProfileId={host._id} bookable={host.bookable} />
                  {isSignedIn ? (
                    <>
                      <button
                        type="button"
                        disabled={startingMessage}
                        onClick={async () => {
                          setStartingMessage(true)
                          setMessageError('')
                          try {
                            const conversationId = await startConversation({ otherUserId: host.userId })
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
                          await toggleFollow({ userId: host.userId })
                          setNotice(host.following ? 'Member unfollowed.' : 'Member followed.')
                        }}
                        className="btn btn-social-quiet btn-sm"
                      >
                        {host.following ? 'Following' : 'Follow'}
                      </button>
                      <button
                        onClick={async () => {
                          await toggleSaveProfile({ hostProfileId: host._id })
                          setNotice(host.saved ? 'Profile removed from saved.' : 'Profile saved.')
                        }}
                        className="btn btn-neutral btn-sm"
                      >
                        {host.saved ? 'Saved profile' : 'Save profile'}
                      </button>
                      <button
                        onClick={async () => {
                          await report({ targetType: 'profile', targetId: host._id, reason: 'Profile needs safety review' })
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

        <div className="host-profile-fit-grid">
          <div>
            <p className="eyebrow">Strengths</p>
            <h2 className="text-h3 mt-1">What {host.firstName} brings to the time</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              {host.strengths.map((strength) => <span key={strength} className="chip" data-selected="true">{strength}</span>)}
            </div>
          </div>
          <div>
            <p className="eyebrow">Ideas</p>
            <h2 className="text-h3 mt-1">Things you could do together</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              {host.categories.map((category) => <span key={category} className="chip">{category}</span>)}
            </div>
          </div>
          <div>
            <p className="eyebrow">Boundaries</p>
            <h2 className="text-h3 mt-1">What keeps it comfortable</h2>
            {host.boundaries.length > 0 ? (
              <ul className="profile-boundary-list mt-3">
                {host.boundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}
              </ul>
            ) : (
              <p className="text-meta mt-3">No additional boundaries listed.</p>
            )}
          </div>
        </div>
      </section>

      <div className="discover-grid">
        <section>
          <header className="mb-3">
            <p className="eyebrow">Ratings</p>
            <h2 className="text-h2 mt-1">What past plans felt like</h2>
          </header>
          {reviews === undefined && <div className="empty-state">Loading reviews...</div>}
          {reviews && reviews.length === 0 && <div className="empty-state">No reviews yet.</div>}
          {reviews && reviews.length > 0 && (
            <div className="panel">
              <div className="worklist">
                {reviews.map((review) => (
                  <ReviewRow
                    key={review._id}
                    review={review}
                    signedIn={Boolean(isSignedIn)}
                    onSave={async () => {
                      await toggleSaveReview({ reviewId: review._id })
                      setNotice(review.saved ? 'Rating removed from saved.' : 'Rating saved.')
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <aside>
          <header className="mb-3">
            <p className="eyebrow">Posts</p>
            <h2 className="text-h2 mt-1">A little more about {host.displayName}</h2>
          </header>
          {posts === undefined && <div className="empty-state">Loading posts...</div>}
          {posts && posts.length === 0 && <div className="empty-state">No posts from this member yet.</div>}
          {posts && posts.length > 0 && (
            <div className="panel">
              <div className="worklist">
                {posts.slice(0, 6).map((post) => (
                  <article key={post._id} className="worklist-row">
                    <div className="worklist-row-meta tabular">{formatTime(post.createdAt)}</div>
                    {post.body && <p className="text-body muted whitespace-pre-wrap">{post.body}</p>}
                    {post.media.length > 0 && <HostPostMediaGrid media={post.media} />}
                  </article>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}

function HostBookingAction({
  eligibility,
  hostProfileId,
  bookable,
}: {
  eligibility: 'eligible' | 'sign_in_required' | 'verification_required' | 'own_profile'
  hostProfileId: Id<'hostProfiles'>
  bookable: boolean
}) {
  if (!bookable) return <span className="status-pill" data-tone="warning">Rate not configured</span>

  if (eligibility === 'eligible') {
    return (
      <Link to="/app" search={{ hostProfileId }} className="btn btn-social btn-sm">
        Book a time
      </Link>
    )
  }

  if (eligibility === 'verification_required') {
    return (
      <Link to="/app" search={{}} className="btn btn-self btn-sm">
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

function HostPostMediaGrid({ media }: { media: HostPostMedia[] }) {
  return (
    <div className="social-media-grid profile-post-media" data-count={media.length}>
      {media.map((item) => (
        <div key={item.storageId} className="social-media-item">
          {item.url && item.kind === 'image' && <img src={item.url} alt="" loading="lazy" />}
          {item.url && item.kind === 'video' && <video src={item.url} controls playsInline preload="metadata" />}
        </div>
      ))}
    </div>
  )
}

function ReviewRow({ review, signedIn, onSave }: { review: HostReview; signedIn: boolean; onSave: () => Promise<void> }) {
  return (
    <article className="worklist-row">
      <div className="worklist-row-head">
        <div className="min-w-0">
          <h3 className="text-h3">{review.rating}★ from {review.reviewerDisplayName}</h3>
          <div className="worklist-row-meta tabular">{formatTime(review.createdAt)}</div>
        </div>
        {signedIn && (
          <button onClick={onSave} className="btn btn-neutral btn-sm">
            {review.saved ? 'Saved rating' : 'Save rating'}
          </button>
        )}
      </div>
      {review.body && <p className="text-body muted">{review.body}</p>}
    </article>
  )
}

function ProfilePhoto({ imageUrl, name, size }: { imageUrl?: string; name: string; size?: 'lg' }) {
  const className = size === 'lg' ? 'profile-photo profile-photo-lg' : 'profile-photo'
  return (
    <span className={className} aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" /> : <span>{initials(name)}</span>}
    </span>
  )
}

function formatMode(mode: string) {
  if (mode === 'both') return 'Online and in-person'
  if (mode === 'in_person') return 'In-person'
  return 'Online'
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
