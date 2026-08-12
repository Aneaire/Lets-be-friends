import { friendHosts } from '@/data/hosts'
import {
  isBackendDemoHostId,
  mapApprovedHost,
  mapFixtureHost,
  mapPublicHost,
  resolveConnectedHost,
  resolveHostBookingAction,
  type ApprovedHostRecord,
} from '@/data/hostViewModels'

const approvedHost: ApprovedHostRecord = {
  _id: 'convex-host-id',
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
  bio: 'Public host bio.',
  boundaries: ['Public places only'],
}

describe('host view-model mapping', () => {
  it('maps authoritative discovery fields and both session formats', () => {
    expect(mapApprovedHost(approvedHost)).toMatchObject({
      source: 'convex',
      sessionModes: ['in_person', 'online'],
      rateLabel: '₱650.00 / hour',
      verified: true,
      bookable: true,
    })
  })

  it('keeps public detail fields supplied by the backend', () => {
    expect(mapPublicHost(approvedHost)).toMatchObject({
      bio: 'Public host bio.',
      boundaries: ['Public places only'],
    })
  })

  it('marks demo hosts non-bookable and never authoritatively verified', () => {
    const backendDemo = mapApprovedHost({ ...approvedHost, _id: 'demo-2', demo: true })
    const localDemo = mapFixtureHost(friendHosts[0])

    expect(backendDemo).toMatchObject({ source: 'backend_demo', verified: false, bookable: false })
    expect(localDemo).toMatchObject({ source: 'local_demo', verified: false, bookable: false })
    expect(isBackendDemoHostId(backendDemo.id)).toBe(true)
    expect(isBackendDemoHostId('convex-host-id')).toBe(false)
  })

  it('preserves truthful public booking eligibility and route decisions', () => {
    const eligible = mapPublicHost(approvedHost)
    expect(eligible).toMatchObject({ hourlyRateCentavos: 65000, viewerBookingEligibility: 'eligible' })
    expect(resolveHostBookingAction(eligible).kind).toBe('book')
    expect(resolveHostBookingAction({ ...eligible, viewerBookingEligibility: 'sign_in_required' }).kind).toBe('sign_in')
    expect(resolveHostBookingAction({ ...eligible, viewerBookingEligibility: 'verification_required' }).kind).toBe('verification')
    expect(resolveHostBookingAction({ ...eligible, viewerBookingEligibility: 'own_profile' }).kind).toBe('own_profile')
    expect(resolveHostBookingAction(mapFixtureHost(friendHosts[0])).kind).toBe('unavailable')
  })

  it('resolves only listed non-demo records as connected approved IDs', () => {
    const demoHost = { ...approvedHost, _id: 'demo-2', demo: true }
    const hosts = [approvedHost, demoHost]

    expect(resolveConnectedHost(hosts, approvedHost._id)).toEqual({ kind: 'approved', record: approvedHost })
    expect(resolveConnectedHost(hosts, demoHost._id)).toEqual({ kind: 'demo', record: demoHost })
    expect(resolveConnectedHost(hosts, undefined)).toEqual({ kind: 'not_found' })
    expect(resolveConnectedHost(hosts, 'mika-santos')).toEqual({ kind: 'not_found' })
    expect(resolveConnectedHost(hosts, 'unknown-deep-link')).toEqual({ kind: 'not_found' })
  })
})
