export type SessionMode = 'in_person' | 'online'
export type CompanionDataSource = 'convex'
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
  latitude?: number
  longitude?: number
  verified: boolean
  bookable: boolean
  viewerBookingEligibility?: ViewerBookingEligibility
  userId?: string
  saved?: boolean
  following?: boolean
  kind?: 'member' | 'companion'
}

export type CompanionDetailViewModel = DiscoveryCompanionViewModel & {
  bio?: string
  boundaries: string[]
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
  latitude?: number
  longitude?: number
  hourlyRateCentavos?: number
  bookable?: boolean
  viewerBookingEligibility?: ViewerBookingEligibility
  bio?: string
  boundaries?: string[]
  userId?: string
  saved?: boolean
  following?: boolean
  kind?: 'member' | 'companion'
  verified?: boolean
}

export function mapApprovedCompanion(companion: ApprovedCompanionRecord): DiscoveryCompanionViewModel {
  return {
    id: companion._id,
    source: 'convex',
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
    hourlyRateCentavos: companion.hourlyRateCentavos,
    distanceLabel: typeof companion.distanceKm === 'number' ? `${companion.distanceKm.toFixed(1)} km away` : undefined,
    latitude: companion.latitude,
    longitude: companion.longitude,
    verified: companion.verified ?? true,
    bookable: companion.bookable === true,
    viewerBookingEligibility: companion.viewerBookingEligibility,
    userId: companion.userId,
    saved: companion.saved,
    following: companion.following,
    kind: companion.kind ?? 'companion',
  }
}

export function mapPublicCompanion(companion: ApprovedCompanionRecord): CompanionDetailViewModel {
  return {
    ...mapApprovedCompanion(companion),
    source: 'convex',
    verified: companion.verified ?? true,
    bio: companion.bio,
    boundaries: companion.boundaries ?? [],
  }
}

export type CompanionBookingAction =
  | { kind: 'sign_in'; label: 'Sign in to book'; explanation: string }
  | { kind: 'verification'; label: 'Verification required'; explanation: string }
  | { kind: 'own_profile'; label: 'Your Companion profile'; explanation: string }
  | { kind: 'book'; label: 'Review booking options'; explanation: string }
  | { kind: 'unavailable'; label: 'Booking unavailable'; explanation: string }

export function resolveCompanionBookingAction(companion: CompanionDetailViewModel): CompanionBookingAction {
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

export type ConnectedCompanionResolution =
  | { kind: 'approved'; record: ApprovedCompanionRecord }
  | { kind: 'not_found' }

export function resolveConnectedCompanion(
  companions: ApprovedCompanionRecord[],
  candidateId: string | undefined,
): ConnectedCompanionResolution {
  if (!candidateId) return { kind: 'not_found' }
  const record = companions.find((companion) => companion._id === candidateId)
  if (!record) return { kind: 'not_found' }
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
