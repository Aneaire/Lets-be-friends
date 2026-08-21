import { SignInButton, useAuth } from '@clerk/react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowLeft, Heart } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/member-profile')({
  validateSearch: (search: Record<string, unknown>): { userId?: string } => (
    typeof search.userId === 'string' ? { userId: search.userId } : {}
  ),
  component: MemberProfilePage,
})

function MemberProfilePage() {
  const { userId } = Route.useSearch()
  const { isSignedIn } = useAuth()
  const profile = useQuery(api.users.publicProfile, userId ? { userId: userId as Id<'users'> } : 'skip')
  const toggleFollow = useMutation(api.social.toggleFollow)

  if (!userId) return <UnavailableProfile detail="Choose someone from Explore first." />
  if (profile === undefined) return <main className="marketing-page"><div className="empty-state">Loading profile...</div></main>
  if (profile === null) return <UnavailableProfile detail="This profile is no longer available." />

  const followLabel = profile.following ? `Unfollow ${profile.displayName}` : `Follow ${profile.displayName}`
  const followButton = (
    <button
      type="button"
      className="discover-follow-icon"
      data-active={profile.following}
      disabled={profile.isViewer}
      onClick={isSignedIn && !profile.isViewer ? () => void toggleFollow({ userId: profile._id }) : undefined}
      aria-label={followLabel}
      title={followLabel}
    >
      <Heart size={17} fill={profile.following ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  )

  return (
    <main className="marketing-page member-profile-page">
      <Link to="/discover" className="member-profile-back"><ArrowLeft size={15} aria-hidden="true" />Explore people</Link>
      <section className="panel member-profile-card">
        <div className="member-profile-photo" aria-hidden="true">
          {profile.profileImageUrl ? <img src={profile.profileImageUrl} alt="" /> : <span>{initials(profile.displayName)}</span>}
        </div>
        <div className="member-profile-copy">
          <div className="member-profile-heading">
            <div>
              <h1 className="text-h1">{profile.displayName}</h1>
              {profile.username && <p className="text-meta mt-1">@{profile.username}</p>}
            </div>
            {profile.isViewer ? <Link to="/profile" className="btn btn-self btn-sm">Edit profile</Link> : isSignedIn ? followButton : <SignInButton mode="modal">{followButton}</SignInButton>}
          </div>
          <span className="trust-chip" data-state={profile.identityVerified ? 'verified' : 'awaiting'}>
            <span className="trust-chip-dot" aria-hidden="true" />
            {profile.identityVerified ? 'Identity checked' : 'Not identity checked'}
          </span>
          <p className="member-profile-bio">{profile.bio || 'This person has not added a bio yet.'}</p>
          {profile.onboardingCategories.length > 0 && (
            <div className="member-profile-interests">
              <p className="eyebrow">Interested in</p>
              <ul>{profile.onboardingCategories.map((category) => <li key={category}>{category}</li>)}</ul>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function UnavailableProfile({ detail }: { detail: string }) {
  return <main className="marketing-page"><h1 className="text-h1">Profile unavailable</h1><p className="lede mt-2">{detail}</p><Link to="/discover" className="btn btn-neutral btn-sm mt-5">Back to Explore</Link></main>
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}
