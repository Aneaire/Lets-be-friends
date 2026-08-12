import type { FriendHost } from './hosts'

export type SessionMode = 'in_person' | 'online'
export type HostDataSource = 'convex' | 'backend_demo' | 'local_demo'
export type ViewerBookingEligibility = 'eligible' | 'sign_in_required' | 'verification_required' | 'own_profile'

export type DiscoveryHostViewModel = {
  id: string
  source: HostDataSource
  name: string
  location: string
  imageUrl?: string
  intro: string
  strengths: string[]
  categories: string[]
  sessionModes: SessionMode[]
  rating?: number
  reviewCount?: number
  rateLabel?: string
  hourlyRateCentavos?: number
  distanceLabel?: string
  verified: boolean
  bookable: boolean
  viewerBookingEligibility?: ViewerBookingEligibility
}

export type HostDetailViewModel = DiscoveryHostViewModel & {
  bio?: string
  boundaries: string[]
  localOnly?: {
    age: number
    pronouns: string
    completedExperiences: number
    responseTime: string
    languages: string[]
    availability: FriendHost['availability']
  }
}

export type ApprovedHostRecord = {
  _id: string
  displayName: string
  city: string
  mode: 'in_person' | 'online' | 'both'
  intro: string
  strengths: string[]
  categories: string[]
  rating?: number
  reviewCount?: number
  profileImageUrl?: string
  distanceKm?: number
  hourlyRateCentavos?: number
  bookable?: boolean
  viewerBookingEligibility?: ViewerBookingEligibility
  demo?: boolean
  bio?: string
  boundaries?: string[]
}

export function mapApprovedHost(host: ApprovedHostRecord): DiscoveryHostViewModel {
  const source = host.demo || isBackendDemoHostId(host._id) ? 'backend_demo' : 'convex'
  return {
    id: host._id,
    source,
    name: host.displayName,
    location: host.city,
    imageUrl: host.profileImageUrl,
    intro: host.intro,
    strengths: host.strengths,
    categories: host.categories,
    sessionModes: mapSessionModes(host.mode),
    rating: host.rating,
    reviewCount: host.reviewCount,
    rateLabel: formatHourlyRate(host.hourlyRateCentavos),
    hourlyRateCentavos: source === 'convex' ? host.hourlyRateCentavos : undefined,
    distanceLabel: typeof host.distanceKm === 'number' ? `${host.distanceKm.toFixed(1)} km away` : undefined,
    verified: source === 'convex',
    bookable: source === 'convex' && host.bookable === true,
    viewerBookingEligibility: source === 'convex' ? host.viewerBookingEligibility : undefined,
  }
}

export function mapPublicHost(host: ApprovedHostRecord): HostDetailViewModel {
  return {
    ...mapApprovedHost(host),
    source: 'convex',
    verified: true,
    bio: host.bio,
    boundaries: host.boundaries ?? [],
  }
}

export function mapFixtureHost(host: FriendHost): HostDetailViewModel {
  return {
    id: host.id,
    source: 'local_demo',
    name: host.name,
    location: host.location,
    imageUrl: host.imageUrl,
    intro: host.tagline,
    strengths: host.strengths,
    categories: host.categories,
    sessionModes: host.sessionModes,
    rating: host.rating,
    reviewCount: host.reviewCount,
    rateLabel: host.rateLabel,
    distanceLabel: host.distance,
    verified: false,
    bookable: false,
    bio: host.bio,
    boundaries: [],
    localOnly: {
      age: host.age,
      pronouns: host.pronouns,
      completedExperiences: host.completedExperiences,
      responseTime: host.responseTime,
      languages: host.languages,
      availability: host.availability,
    },
  }
}

export function mapFixtureDiscoveryHost(host: FriendHost): DiscoveryHostViewModel {
  const { localOnly: _localOnly, boundaries: _boundaries, bio: _bio, ...discoveryHost } = mapFixtureHost(host)
  return discoveryHost
}

export type HostBookingAction =
  | { kind: 'sign_in'; label: 'Sign in to book'; explanation: string }
  | { kind: 'verification'; label: 'Verification required'; explanation: string }
  | { kind: 'own_profile'; label: 'Your Friend Host profile'; explanation: string }
  | { kind: 'book'; label: 'Review booking options'; explanation: string }
  | { kind: 'unavailable'; label: 'Booking unavailable'; explanation: string }

export function resolveHostBookingAction(host: HostDetailViewModel): HostBookingAction {
  if (host.source !== 'convex') {
    return { kind: 'unavailable', label: 'Booking unavailable', explanation: 'Demo profiles cannot receive booking requests.' }
  }
  if (!host.bookable) {
    return { kind: 'unavailable', label: 'Booking unavailable', explanation: 'This Friend Host is not accepting booking requests right now.' }
  }
  switch (host.viewerBookingEligibility) {
    case 'eligible':
      return { kind: 'book', label: 'Review booking options', explanation: 'Check current booking availability and plan details before sending a request.' }
    case 'verification_required':
      return { kind: 'verification', label: 'Verification required', explanation: 'Identity verification must be approved before you can request a booking.' }
    case 'own_profile':
      return { kind: 'own_profile', label: 'Your Friend Host profile', explanation: 'You cannot book your own Friend Host profile.' }
    case 'sign_in_required':
    default:
      return { kind: 'sign_in', label: 'Sign in to book', explanation: 'Sign in to request a booking with this Friend Host.' }
  }
}

export function isBackendDemoHostId(id: string) {
  return /^demo-[1-9]\d*$/.test(id)
}

export type ConnectedHostResolution =
  | { kind: 'approved'; record: ApprovedHostRecord }
  | { kind: 'demo'; record: ApprovedHostRecord }
  | { kind: 'not_found' }

export function resolveConnectedHost(
  hosts: ApprovedHostRecord[],
  candidateId: string | undefined,
): ConnectedHostResolution {
  if (!candidateId) return { kind: 'not_found' }
  const record = hosts.find((host) => host._id === candidateId)
  if (!record) return { kind: 'not_found' }
  if (record.demo === true || isBackendDemoHostId(record._id)) return { kind: 'demo', record }
  return { kind: 'approved', record }
}

function mapSessionModes(mode: ApprovedHostRecord['mode']): SessionMode[] {
  if (mode === 'both') return ['in_person', 'online']
  return [mode]
}

function formatHourlyRate(hourlyRateCentavos: number | undefined) {
  if (!Number.isSafeInteger(hourlyRateCentavos) || !hourlyRateCentavos || hourlyRateCentavos <= 0) return undefined
  return `${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(hourlyRateCentavos / 100)} / hour`
}
