import { MapPin, Users } from 'lucide-react'
import { cloneElement, type ReactElement, type ReactNode } from 'react'
import { BrandLogo } from '../../design-system/atoms/BrandLogo'

// Circle list rows and the compact home module card are intentionally separate
// variants: they share CircleMarker and the link-slot cloning contract but have
// different grids, density, and meta content, so a single flag-driven card
// would obscure both designs.
export type CircleCardView = {
  name: string
  mode: 'online' | 'in_person' | 'both'
  iconUrl?: string
  purpose: string
  category: string
  memberCount: number
  approximateArea?: string
  membershipState?: string | null
  circleState?: string | null
  role?: string | null
  joinPolicy?: 'approval_required' | 'open' | null
}

export type CircleHomeCardView = Pick<
  CircleCardView,
  'name' | 'mode' | 'iconUrl' | 'memberCount' | 'membershipState'
>

type CircleLinkElementProps = {
  className?: string
  children?: ReactNode
}

export type CircleLinkElement = ReactElement<CircleLinkElementProps>

function formatCircleMode(mode: CircleCardView['mode']) {
  return mode === 'in_person' ? 'In person' : mode === 'online' ? 'Online' : 'Online and in person'
}

export function CircleMarker({ circle }: {
  circle: Pick<CircleCardView, 'mode' | 'iconUrl' | 'name'> & { membershipState?: string | null }
}) {
  const mode = formatCircleMode(circle.mode)
  if (circle.iconUrl) {
    return <img className="circle-icon" src={circle.iconUrl} alt={`${circle.name}, ${mode}${circle.membershipState === 'active' ? ', joined' : ''}`} />
  }
  return <span className="circle-marker" data-member={circle.membershipState === 'active'} role="img" aria-label={`${mode}${circle.membershipState === 'active' ? ', joined' : ''}`}><BrandLogo className="circle-marker-logo" /></span>
}

export function CircleCard({ link, circle }: { link: CircleLinkElement; circle: CircleCardView }) {
  const area = circle.approximateArea ?? (circle.mode === 'online' ? 'Online' : 'Area shared in Circle')
  return cloneElement(
    link,
    { className: 'circle-index-row' },
    <CircleMarker key="marker" circle={circle} />,
    <span key="copy" className="circle-index-copy">
      <span className="circle-index-title">
        <strong>{circle.name}</strong>
        {circle.role && circle.role !== 'member' && <span className="status-pill" data-tone="social">{circle.role}</span>}
        {circle.circleState === 'archived' && <span className="status-pill">Archived</span>}
        {circle.joinPolicy === 'open' && <span className="status-pill" data-tone="social">Open join</span>}
      </span>
      <span>{circle.purpose}</span>
      <span className="circle-index-meta">
        <span><Users size={13} aria-hidden="true" /> {circle.memberCount} {circle.memberCount === 1 ? 'member' : 'members'}</span>
        <span><MapPin size={13} aria-hidden="true" /> {area}</span>
      </span>
    </span>,
    <span key="category" className="circle-index-category">{circle.category}</span>,
  )
}

export function CircleHomeCard({ link, circle }: { link: CircleLinkElement; circle: CircleHomeCardView }) {
  return cloneElement(
    link,
    {},
    <CircleMarker key="marker" circle={circle} />,
    <span key="copy">
      <strong>{circle.name}</strong>
      <small>{circle.memberCount} members</small>
    </span>,
  )
}
