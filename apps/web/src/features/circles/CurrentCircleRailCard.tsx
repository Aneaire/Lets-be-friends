import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { CircleDot } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { CircleMarker } from '../presentation/CircleCards'
import { FlipCard } from '../social/FriendayGuide'

export type RailCircle = {
  _id: string
  name: string
  purpose: string
  category: string
  mode: 'online' | 'in_person' | 'both'
  iconUrl?: string
  memberCount: number
  approximateArea?: string
  membershipState?: string | null
  circleState?: string | null
  role?: string | null
  muted?: boolean
}

/**
 * Facebook puts pinned groups on top of the left sidebar and orders the rest
 * by recent visits and activity. We have no pinning yet, so the top circle is
 * the most recently updated active membership: `api.circles.mine` already
 * returns memberships sorted by `updatedAt` descending, and this selector
 * keeps that order, keeps only active memberships, and shows up to three more
 * below the current one.
 */
export function selectCurrentCircles(mine: unknown) {
  const rows = (Array.isArray(mine) ? mine : []).filter(
    (circle): circle is RailCircle =>
      Boolean(circle) && (circle as RailCircle).membershipState === 'active',
  )
  return { top: rows[0] ?? null, rest: rows.slice(1, 4), totalActive: rows.length }
}

function formatRailMode(mode: RailCircle['mode']) {
  if (mode === 'in_person') return 'In person'
  if (mode === 'online') return 'Online'
  return 'Online and in person'
}

export function CurrentCircleRailCard() {
  const mine = useQuery(api.circles.mine)

  if (mine === undefined) {
    return (
      <section className="frienday-rail-card" aria-label="Your current circle">
        <p role="status" className="text-meta">
          Loading your circles...
        </p>
      </section>
    )
  }

  const { top, rest, totalActive } = selectCurrentCircles(mine)

  if (!top) {
    return (
      <FlipCard
        icon={CircleDot}
        eyebrow="Circles"
        title="Your current circle"
        teaser="Join a Circle to pin it here."
        previewLabel="No circles yet"
        defaultOpen
      >
        <p className="text-meta frienday-rail-intro">
          Circles are small groups that share interests, plans, and conversations. Your most
          recent Circle will sit at the top of this rail.
        </p>
        <div className="frienday-rail-actions">
          <Link to="/circles" className="btn btn-social btn-sm">
            Discover circles
          </Link>
        </div>
      </FlipCard>
    )
  }

  return (
    <FlipCard
      icon={CircleDot}
      eyebrow="Circles"
      title="Your current circle"
      previewLabel={
        totalActive === 1 ? '1 circle, tap to open' : `${totalActive} circles, tap to open`
      }
      defaultOpen
    >
      <Link
        to="/circles/$circleId"
        params={{ circleId: String(top._id) }}
        className="current-circle-hero current-circle-hero-link"
        aria-label={`Open ${top.name}`}
      >
        <CircleMarker circle={top} />
        <span className="current-circle-copy">
          <strong className="current-circle-name">{top.name}</strong>
          <span className="text-meta current-circle-meta">
            {top.memberCount} {top.memberCount === 1 ? 'member' : 'members'} ·{' '}
            {formatRailMode(top.mode)}
            {top.role && top.role !== 'member' ? (
              <span className="status-pill" data-tone="social">
                {top.role}
              </span>
            ) : null}
            {top.muted ? <span className="text-soft"> · Muted</span> : null}
          </span>
        </span>
      </Link>

      {rest.length > 0 && (
        <ul className="current-circle-rows" aria-label="More of your circles">
          {rest.map((circle) => (
            <li key={String(circle._id)}>
              <Link
                to="/circles/$circleId"
                params={{ circleId: String(circle._id) }}
                className="current-circle-row"
              >
                <CircleMarker circle={circle} />
                <span className="current-circle-row-copy">
                  <strong>{circle.name}</strong>
                  <small className="text-meta">
                    {circle.memberCount} {circle.memberCount === 1 ? 'member' : 'members'}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link to="/circles" className="frienday-rail-link">
        See all circles
      </Link>
    </FlipCard>
  )
}
