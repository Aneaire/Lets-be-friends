import type { DiscoveryCompanionViewModel } from '@/data/companionViewModels'
import { nearbyCompanionMeta, nearbyCompanionRating, nearbyCompanionStrengths, nearbyMapPoints } from '@/features/discovery/nearbyMapSelection'

function companion(overrides: Partial<DiscoveryCompanionViewModel> = {}): DiscoveryCompanionViewModel {
  return {
    id: 'companion-1',
    source: 'convex',
    name: 'Alex Rivera',
    location: 'Angeles City',
    intro: 'Weekend hikes and coffee walks.',
    strengths: ['Hiking', 'Coffee', 'Photography', 'Board games'],
    categories: ['Outdoors'],
    sessionModes: ['in_person'],
    verified: true,
    bookable: true,
    latitude: 15.145,
    longitude: 120.588,
    ...overrides,
  }
}

describe('nearby map pins', () => {
  it('carries the profile photo and name for each companion that has a location', () => {
    expect(nearbyMapPoints([companion({ imageUrl: 'https://example.test/alex.jpg' })])).toEqual([
      {
        id: 'companion-1',
        name: 'Alex Rivera',
        imageUrl: 'https://example.test/alex.jpg',
        latitude: 15.145,
        longitude: 120.588,
      },
    ])
  })

  it('keeps pin order and skips companions without both coordinates', () => {
    const points = nearbyMapPoints([
      companion({ id: 'a', latitude: 15.1 }),
      companion({ id: 'b', latitude: 15.2, longitude: undefined }),
      companion({ id: 'c', latitude: undefined, longitude: 120.6 }),
      companion({ id: 'd', latitude: 15.4, longitude: 120.7 }),
    ])
    expect(points.map((point) => point.id)).toEqual(['a', 'd'])
  })

  it('allows a pin without a profile photo so the map can fall back to initials', () => {
    expect(nearbyMapPoints([companion()])[0]?.imageUrl).toBeUndefined()
  })
})

describe('nearby companion detail copy', () => {
  it('joins city and approximate distance for the sheet subtitle', () => {
    expect(nearbyCompanionMeta(companion({ distanceLabel: '2.4 km away' }))).toBe('Angeles City · 2.4 km away')
    expect(nearbyCompanionMeta(companion())).toBe('Angeles City')
  })

  it('summarises ratings with a single review count label', () => {
    expect(nearbyCompanionRating(companion({ rating: 4.8, reviewCount: 1 }))).toBe('4.8 ★ (1 review)')
    expect(nearbyCompanionRating(companion({ rating: 4.8, reviewCount: 12 }))).toBe('4.8 ★ (12 reviews)')
    expect(nearbyCompanionRating(companion({ rating: undefined, reviewCount: undefined }))).toBe('New Companion')
    expect(nearbyCompanionRating(companion({ rating: 5, reviewCount: 0 }))).toBe('New Companion')
  })

  it('shows at most three Strengths on the sheet', () => {
    expect(nearbyCompanionStrengths(companion())).toEqual(['Hiking', 'Coffee', 'Photography'])
    expect(nearbyCompanionStrengths(companion({ strengths: ['Coffee'] }))).toEqual(['Coffee'])
  })
})
