// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { MouseEvent, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const viewerState = vi.hoisted(() => ({ value: undefined as unknown }))
const companionsState = vi.hoisted(() => ({ value: [] as unknown[] }))
const lastCompanionArgs = vi.hoisted(() => ({ value: undefined as unknown }))
const updateLocation = vi.hoisted(() => vi.fn(async () => ({ latitude: 14.6, longitude: 120.98 })))

const sharedViewer = {
  _id: 'viewer',
  clerkUserId: 'clerk-viewer',
  displayName: 'Ate Member',
  approximateLatitude: 10.32,
  approximateLongitude: 123.89,
  approximateLocationConsentedAt: 1_700_000_000_000,
}

const nearbyCompanions = [
  {
    _id: 'companion-1',
    displayName: 'Nearby Companion',
    city: 'Cebu City',
    mode: 'both',
    rating: 4.9,
    reviewCount: 4,
    intro: 'Coffee walks and errands.',
    strengths: [],
    categories: [],
    bookable: true,
    distanceKm: 3,
    latitude: 10.31,
    longitude: 123.9,
  },
]

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: { viewer: 'users.viewer', updateApproximateLocation: 'users.updateApproximateLocation' },
    companions: { listApproved: 'companions.listApproved' },
    social: { toggleFollow: 'social.toggleFollow' },
  },
}))

vi.mock('convex/react', () => ({
  useMutation: (reference: unknown) => (
    reference === 'users.updateApproximateLocation' ? updateLocation : vi.fn()
  ),
  useQuery: (queryRef: unknown, args: unknown) => {
    if (queryRef === 'users.viewer') return viewerState.value
    if (queryRef === 'companions.listApproved') {
      lastCompanionArgs.value = args
      return args === 'skip' ? undefined : companionsState.value
    }
    return undefined
  },
}))

vi.mock('@clerk/react', () => ({ useAuth: () => ({ isSignedIn: true }) }))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Navigate: () => null,
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a
      href={to}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => event.preventDefault()}
      {...props}
    >
      {children}
    </a>
  ),
}))

vi.mock('../../src/design-system/organisms/CompanionListItem', () => ({
  CompanionListItem: ({ companion }: { companion: { displayName: string } }) => (
    <div role="listitem">{companion.displayName}</div>
  ),
}))

vi.mock('../../src/design-system/organisms/ApproximateLocationMap', () => ({
  ApproximateLocationMap: ({ title, description }: { title?: string; description?: string }) => (
    <div data-testid="nearby-map">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}))

import { NearbySearchPage } from '../../src/routes/nearby'

beforeEach(() => {
  viewerState.value = sharedViewer
  companionsState.value = nearbyCompanions
  lastCompanionArgs.value = undefined
  updateLocation.mockClear()
})

afterEach(() => {
  cleanup()
  // @ts-expect-error jsdom has no geolocation; remove the per-test stub.
  delete navigator.geolocation
})

describe('Explore nearby search', () => {
  it('searches from the location the member already shared without asking again', () => {
    render(<NearbySearchPage />)

    expect(screen.getByRole('status').textContent).toContain('Using your saved location.')
    expect(screen.getByTestId('nearby-map').textContent).toContain('Your saved location · 25 km')
    expect(screen.getByText('1 person')).toBeTruthy()
    expect(screen.getByText('Nearby Companion')).toBeTruthy()
    expect(lastCompanionArgs.value).toEqual({ latitude: 10.32, longitude: 123.89, radiusKm: 25 })
    expect(screen.getByRole('button', { name: 'Use my location' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('waits for a choice when the member has not shared a location', () => {
    viewerState.value = { ...sharedViewer, approximateLocationConsentedAt: undefined }
    render(<NearbySearchPage />)

    expect(screen.getByText('Choose an area')).toBeTruthy()
    expect(screen.getByText('Start with an area')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Use your location or place a travel pin to begin.')
    expect(lastCompanionArgs.value).toBe('skip')
  })

  it('saves a fresh location when the member uses their location', async () => {
    const getCurrentPosition = vi.fn((success: (position: unknown) => void) => {
      success({ coords: { latitude: 14.599512, longitude: 120.984222 } })
      return 1
    })
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })

    render(<NearbySearchPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))

    await waitFor(() => expect(updateLocation).toHaveBeenCalledWith({
      latitude: 14.599512,
      longitude: 120.984222,
    }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Saved area updated.'))
    // The search follows the saved (jittered) point the mutation returned, not
    // the raw device fix.
    expect(lastCompanionArgs.value).toEqual({ latitude: 14.6, longitude: 120.98, radiusKm: 25 })
  })
})
