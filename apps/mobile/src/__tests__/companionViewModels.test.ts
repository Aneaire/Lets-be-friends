import { companions } from '@/data/companions'
import {
  isBackendDemoCompanionId,
  mapApprovedCompanion,
  mapFixtureCompanion,
  mapPublicCompanion,
  resolveConnectedCompanion,
  resolveCompanionBookingAction,
  type ApprovedCompanionRecord,
} from '@/data/companionViewModels'

const approvedCompanion: ApprovedCompanionRecord = {
  _id: 'convex-companion-id',
  displayName: 'Ari',
  city: 'Cebu City',
  mode: 'both',
  intro: 'Calm coffee and online conversation.',
  strengths: ['Good listener'],
  categories: ['Coffee and meals'],
  rating: 4.9,
  reviewCount: 8,
  hourlyRateCentavos: 65000,
  bookable: true,
  viewerBookingEligibility: 'eligible',
  demo: false,
  bio: 'Public companion bio.',
  boundaries: ['Public places only'],
}

describe('companion view-model mapping', () => {
  it('maps authoritative discovery fields and both session formats', () => {
    expect(mapApprovedCompanion(approvedCompanion)).toMatchObject({
      source: 'convex',
      sessionModes: ['in_person', 'online'],
      rateLabel: '₱650.00 / hour',
      verified: true,
      bookable: true,
    })
  })

  it('keeps public detail fields supplied by the backend', () => {
    expect(mapPublicCompanion(approvedCompanion)).toMatchObject({
      bio: 'Public companion bio.',
      boundaries: ['Public places only'],
    })
  })

  it('marks demo companions non-bookable and never authoritatively verified', () => {
    const backendDemo = mapApprovedCompanion({ ...approvedCompanion, _id: 'demo-2', demo: true })
    const localDemo = mapFixtureCompanion(companions[0])

    expect(backendDemo).toMatchObject({ source: 'backend_demo', verified: false, bookable: false })
    expect(localDemo).toMatchObject({ source: 'local_demo', verified: false, bookable: false })
    expect(isBackendDemoCompanionId(backendDemo.id)).toBe(true)
    expect(isBackendDemoCompanionId('convex-companion-id')).toBe(false)
  })

  it('preserves truthful public booking eligibility and route decisions', () => {
    const eligible = mapPublicCompanion(approvedCompanion)
    expect(eligible).toMatchObject({ hourlyRateCentavos: 65000, viewerBookingEligibility: 'eligible' })
    expect(resolveCompanionBookingAction(eligible).kind).toBe('book')
    expect(resolveCompanionBookingAction({ ...eligible, viewerBookingEligibility: 'sign_in_required' }).kind).toBe('sign_in')
    expect(resolveCompanionBookingAction({ ...eligible, viewerBookingEligibility: 'verification_required' }).kind).toBe('verification')
    expect(resolveCompanionBookingAction({ ...eligible, viewerBookingEligibility: 'own_profile' }).kind).toBe('own_profile')
    expect(resolveCompanionBookingAction(mapFixtureCompanion(companions[0])).kind).toBe('unavailable')
  })

  it('resolves only listed non-demo records as connected approved IDs', () => {
    const demoCompanion = { ...approvedCompanion, _id: 'demo-2', demo: true }
    const companions = [approvedCompanion, demoCompanion]

    expect(resolveConnectedCompanion(companions, approvedCompanion._id)).toEqual({ kind: 'approved', record: approvedCompanion })
    expect(resolveConnectedCompanion(companions, demoCompanion._id)).toEqual({ kind: 'demo', record: demoCompanion })
    expect(resolveConnectedCompanion(companions, undefined)).toEqual({ kind: 'not_found' })
    expect(resolveConnectedCompanion(companions, 'mika-santos')).toEqual({ kind: 'not_found' })
    expect(resolveConnectedCompanion(companions, 'unknown-deep-link')).toEqual({ kind: 'not_found' })
  })
})
