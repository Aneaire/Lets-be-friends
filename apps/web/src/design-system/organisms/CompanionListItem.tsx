import { SignInButton } from '@clerk/react'
import { discoveryResultIntro, formatPhp } from '@lets-be-friends/shared'
import { BadgeCheck, Heart, Star } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { Avatar } from '../atoms/Avatar'

export type DiscoveryCompanion = {
  _id: string
  displayName: string
  city: string
  mode: 'online' | 'in_person' | 'both'
  rating: number
  reviewCount?: number
  intro: string
  strengths: string[]
  categories?: string[]
  bookable?: boolean
  viewerCanBook?: boolean
  viewerBookingEligibility?: 'eligible' | 'sign_in_required' | 'verification_required' | 'own_profile'
  saved?: boolean
  following?: boolean
  userId?: string
  profileImageUrl?: string
  distanceKm?: number
  latitude?: number
  longitude?: number
  bio?: string
  kind?: 'member' | 'companion'
  verified?: boolean
  hourlyRateCentavos?: number
}

export function CompanionListItem({ companion, signedIn, onFollow, profileLink: ProfileLink = 'a', profileLinkProps = { href: '#' } }: {
  companion: DiscoveryCompanion
  signedIn: boolean
  onFollow: () => Promise<void>
  profileLink?: ComponentType<any> | 'a'
  profileLinkProps?: Record<string, unknown>
}) {
  const hasDistance = typeof companion.distanceKm === 'number'
  const hasCompanionProfile = companion.kind !== 'member'
  const intro = discoveryResultIntro(companion.kind, companion.intro)
  const profileLink = (children: ReactNode, className: string, label?: string) => (
    <ProfileLink {...profileLinkProps} className={className} aria-label={label}>
      {children}
    </ProfileLink>
  )

  return (
    <div className="discover-host-row" data-nearby={hasDistance} data-kind={hasCompanionProfile ? 'companion' : 'member'} role="listitem">
      {profileLink(
        <Avatar name={companion.displayName} src={companion.profileImageUrl} size="large" decorative />,
        'discover-host-avatar-link',
        `View ${companion.displayName}'s profile`,
      )}

      <div className="discover-host-main">
        <header className="discover-host-identity">
          <div className="discover-host-name-row">
            <h2>
              {profileLink(companion.displayName, 'discover-host-name-link')}
            </h2>
            {companion.verified && (
              <span className="discover-identity-status">
                <BadgeCheck size={13} aria-hidden="true" />
                Identity checked
              </span>
            )}
          </div>
          <div className="discover-host-context">
            {hasCompanionProfile ? (
              <>
                <span>{companion.city}</span>
                <span aria-hidden="true">·</span>
                <span>{formatMode(companion.mode)}</span>
              </>
            ) : <span>Member</span>}
          </div>
        </header>

        {intro && <p className="discover-host-intro">{intro}</p>}

        {hasCompanionProfile && (
          <div className="discover-host-mobile-facts">
            {hasDistance && <DistanceStamp distanceKm={companion.distanceKm!} compact />}
            <RatingSummary rating={companion.rating} reviewCount={companion.reviewCount ?? 0} compact />
            {companion.hourlyRateCentavos && <RateSummary hourlyRateCentavos={companion.hourlyRateCentavos} />}
          </div>
        )}
      </div>

      <aside className="discover-host-side" aria-label={`Actions for ${companion.displayName}`}>
        {hasCompanionProfile && (
          <div className="discover-host-desktop-facts">
            {hasDistance && <DistanceStamp distanceKm={companion.distanceKm!} />}
            <RatingSummary rating={companion.rating} reviewCount={companion.reviewCount ?? 0} />
            {companion.hourlyRateCentavos && <RateSummary hourlyRateCentavos={companion.hourlyRateCentavos} />}
          </div>
        )}
        <FollowIconButton companion={companion} signedIn={signedIn} onFollow={onFollow} />
      </aside>
    </div>
  )
}

function FollowIconButton({ companion, signedIn, onFollow }: {
  companion: DiscoveryCompanion
  signedIn: boolean
  onFollow: () => Promise<void>
}) {
  const label = companion.following ? `Unfollow ${companion.displayName}` : `Follow ${companion.displayName}`
  const button = (
    <button
      type="button"
      onClick={signedIn ? onFollow : undefined}
      className="discover-follow-icon"
      data-active={companion.following}
      disabled={signedIn && (!companion.userId || companion.viewerBookingEligibility === 'own_profile')}
      aria-label={label}
      title={label}
    >
      <Heart size={17} fill={companion.following ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  )

  return signedIn ? button : <SignInButton mode="modal">{button}</SignInButton>
}

function DistanceStamp({ distanceKm, compact = false }: { distanceKm: number; compact?: boolean }) {
  return (
    <div className="discover-host-distance" data-compact={compact} aria-label={`${distanceKm} kilometers away`}>
      <strong className="tabular">{distanceKm}</strong>
      <small>km away</small>
    </div>
  )
}

function RatingSummary({ rating, reviewCount, compact = false }: { rating: number; reviewCount: number; compact?: boolean }) {
  return (
    <div className="discover-host-rating">
      <Star size={14} fill="currentColor" aria-hidden="true" />
      <strong className="tabular" aria-label={`${rating.toFixed(1)} out of 5 stars`}>{rating.toFixed(1)}</strong>
      <span>·</span>
      <span className="tabular">{compact ? `(${reviewCount})` : `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}`}</span>
    </div>
  )
}

function RateSummary({ hourlyRateCentavos }: { hourlyRateCentavos: number }) {
  return <strong className="discover-host-rate tabular">{formatPhp(hourlyRateCentavos)} <small>/ hour</small></strong>
}

function formatMode(mode: DiscoveryCompanion['mode']) {
  if (mode === 'both') return 'Online and in-person'
  if (mode === 'in_person') return 'In-person'
  return 'Online'
}
