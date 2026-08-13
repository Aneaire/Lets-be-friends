import type { Companion } from './companions'

export type SessionMode = 'in_person' | 'online'
export type CompanionDataSource = 'convex' | 'backend_demo' | 'local_demo'
export type ViewerBookingEligibility = 'eligible' | 'sign_in_required' | 'verification_required' | 'own_profile'

export type DiscoveryCompanionViewModel = {
  id: string
  source: CompanionDataSource
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

export type CompanionDetailViewModel = DiscoveryCompanionViewModel & {
  bio?: string
  boundaries: string[]
  localOnly?: {
    age: number
    pronouns: string
    completedExperiences: number
    responseTime: string
    languages: string[]
    availability: Companion['availability']
  }
}

export type ApprovedCompanionRecord = {
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

export function mapApprovedCompanion(companion: ApprovedCompanionRecord): DiscoveryCompanionViewModel {
  const source = companion.demo || isBackendDemoCompanionId(companion._id) ? 'backend_demo' : 'convex'
  return {
    id: companion._id,
    source,
    name: companion.displayName,
    location: companion.city,
    imageUrl: companion.profileImageUrl,
    intro: companion.intro,
    strengths: companion.strengths,
    categories: companion.categories,
    sessionModes: mapSessionModes(companion.mode),
    rating: companion.rating,
    reviewCount: companion.reviewCount,
    rateLabel: formatHourlyRate(companion.hourlyRateCentavos),
    hourlyRateCentavos: source === 'convex' ? companion.hourlyRateCentavos : undefined,
    distanceLabel: typeof companion.distanceKm === 'number' ? `${companion.distanceKm.toFixed(1)} km away` : undefined,
    verified: source === 'convex',
    bookable: source === 'convex' && companion.bookable === true,
    viewerBookingEligibility: source === 'convex' ? companion.viewerBookingEligibility : undefined,
  }
}

export function mapPublicCompanion(companion: ApprovedCompanionRecord): CompanionDetailViewModel {
  return {
    ...mapApprovedCompanion(companion),
    source: 'convex',
    verified: true,
    bio: companion.bio,
    boundaries: companion.boundaries ?? [],
  }
}

export function mapFixtureCompanion(companion: Companion): CompanionDetailViewModel {
  return {
    id: companion.id,
    source: 'local_demo',
    name: companion.name,
    location: companion.location,
    imageUrl: companion.imageUrl,
    intro: companion.tagline,
    strengths: companion.strengths,
    categories: companion.categories,
    sessionModes: companion.sessionModes,
    rating: companion.rating,
    reviewCount: companion.reviewCount,
    rateLabel: companion.rateLabel,
    distanceLabel: companion.distance,
    verified: false,
    bookable: false,
    bio: companion.bio,
    boundaries: [],
    localOnly: {
      age: companion.age,
      pronouns: companion.pronouns,
      completedExperiences: companion.completedExperiences,
      responseTime: companion.responseTime,
      languages: companion.languages,
      availability: companion.availability,
    },
  }
}

export function mapFixtureDiscoveryCompanion(companion: Companion): DiscoveryCompanionViewModel {
  const { localOnly: _localOnly, boundaries: _boundaries, bio: _bio, ...discoveryCompanion } = mapFixtureCompanion(companion)
  return discoveryCompanion
}

export type CompanionBookingAction =
  | { kind: 'sign_in'; label: 'Sign in to book'; explanation: string }
  | { kind: 'verification'; label: 'Verification required'; explanation: string }
  | { kind: 'own_profile'; label: 'Your Companion profile'; explanation: string }
  | { kind: 'book'; label: 'Review booking options'; explanation: string }
  | { kind: 'unavailable'; label: 'Booking unavailable'; explanation: string }

export function resolveCompanionBookingAction(companion: CompanionDetailViewModel): CompanionBookingAction {
  if (companion.source !== 'convex') {
    return { kind: 'unavailable', label: 'Booking unavailable', explanation: 'Demo profiles cannot receive booking requests.' }
  }
  if (!companion.bookable) {
    return { kind: 'unavailable', label: 'Booking unavailable', explanation: 'This Companion is not accepting booking requests right now.' }
  }
  switch (companion.viewerBookingEligibility) {
    case 'eligible':
      return { kind: 'book', label: 'Review booking options', explanation: 'Check current booking availability and plan details before sending a request.' }
    case 'verification_required':
      return { kind: 'verification', label: 'Verification required', explanation: 'Identity verification must be approved before you can request a booking.' }
    case 'own_profile':
      return { kind: 'own_profile', label: 'Your Companion profile', explanation: 'You cannot book your own Companion profile.' }
    case 'sign_in_required':
    default:
      return { kind: 'sign_in', label: 'Sign in to book', explanation: 'Sign in to request a booking with this Companion.' }
  }
}

export function isBackendDemoCompanionId(id: string) {
  return /^demo-[1-9]\d*$/.test(id)
}

export type ConnectedCompanionResolution =
  | { kind: 'approved'; record: ApprovedCompanionRecord }
  | { kind: 'demo'; record: ApprovedCompanionRecord }
  | { kind: 'not_found' }

export function resolveConnectedCompanion(
  companions: ApprovedCompanionRecord[],
  candidateId: string | undefined,
): ConnectedCompanionResolution {
  if (!candidateId) return { kind: 'not_found' }
  const record = companions.find((companion) => companion._id === candidateId)
  if (!record) return { kind: 'not_found' }
  if (record.demo === true || isBackendDemoCompanionId(record._id)) return { kind: 'demo', record }
  return { kind: 'approved', record }
}

function mapSessionModes(mode: ApprovedCompanionRecord['mode']): SessionMode[] {
  if (mode === 'both') return ['in_person', 'online']
  return [mode]
}

function formatHourlyRate(hourlyRateCentavos: number | undefined) {
  if (!Number.isSafeInteger(hourlyRateCentavos) || !hourlyRateCentavos || hourlyRateCentavos <= 0) return undefined
  return `${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(hourlyRateCentavos / 100)} / hour`
}
