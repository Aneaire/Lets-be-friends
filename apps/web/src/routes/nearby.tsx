import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { ArrowLeft, LocateFixed, MapPin, RotateCcw } from 'lucide-react'
import { activityCategoriesMatch, activityCategoryOptions, friendStrengths } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { EmptyState } from '../design-system/molecules/FeedbackState'
import { SearchField } from '../design-system/molecules/SearchField'
import { CompanionListItem, type DiscoveryCompanion } from '../design-system/organisms/CompanionListItem'
import { ApproximateLocationMap } from '../design-system/organisms/ApproximateLocationMap'
import {
  geolocationErrorMessage,
  nearbyRadiusOptions,
  type Coordinates,
  type NearbyRadiusKm,
} from '../lib/geo'

export const Route = createFileRoute('/nearby')({ component: NearbySearchPage })

type ModeFilter = 'all' | 'online' | 'in_person' | 'both'

type NearbyCompanion = {
  _id: string
  userId?: string
  kind?: 'member' | 'companion'
  displayName: string
  city: string
  mode: 'online' | 'in_person' | 'both'
  rating: number
  reviewCount?: number
  intro: string
  strengths: string[]
  categories?: string[]
  bookable?: boolean
  profileImageUrl?: string
  distanceKm?: number
  latitude?: number
  longitude?: number
  bio?: string
  verified?: boolean
}

function NearbySearchPage() {
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const toggleFollow = useMutation(api.social.toggleFollow)
  const [location, setLocation] = useState<Coordinates | null>(null)
  const [originMode, setOriginMode] = useState<'device' | 'custom' | null>(null)
  const [radiusKm, setRadiusKm] = useState<NearbyRadiusKm>(25)
  const [mode, setMode] = useState<ModeFilter>('all')
  const [category, setCategory] = useState('')
  const [strength, setStrength] = useState('')
  const [bookableOnly, setBookableOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [locationStatus, setLocationStatus] = useState('Use your location or place a travel pin to begin.')

  const companionsQuery = useQuery(
    api.companions.listApproved,
    location ? { ...location, radiusKm } : 'skip',
  )
  const companions = (companionsQuery ?? []) as NearbyCompanion[]
  const categories = useMemo(
    () => activityCategoryOptions(...companions.map((companion) => companion.categories)),
    [companions],
  )

  const filtered = useMemo(() => {
    const searchTerm = query.trim().toLowerCase()
    return companions.filter((companion) => {
      if (mode !== 'all' && companion.mode !== mode && !(mode === 'online' && companion.mode === 'both')) return false
      if (category && !(companion.categories ?? []).some((value) => activityCategoriesMatch(value, category))) return false
      if (strength && !companion.strengths.includes(strength)) return false
      if (bookableOnly && !companion.bookable) return false
      if (!searchTerm) return true
      return [
        companion.displayName,
        companion.city,
        companion.intro,
        companion.bio ?? '',
        ...(companion.strengths ?? []),
        ...(companion.categories ?? []),
      ].join(' ').toLowerCase().includes(searchTerm)
    })
  }, [bookableOnly, category, companions, mode, query, strength])

  const mapPeople = useMemo(() => filtered
    .filter((companion) => typeof companion.distanceKm === 'number'
      && typeof companion.latitude === 'number'
      && typeof companion.longitude === 'number')
    .map((companion) => ({
      key: companion._id,
      latitude: companion.latitude!,
      longitude: companion.longitude!,
      imageUrl: companion.profileImageUrl,
      name: companion.displayName,
      city: companion.city,
      intro: companion.intro,
      rating: companion.rating,
      reviewCount: companion.reviewCount,
      strengths: companion.strengths,
      status: companion.bookable ? ('verified' as const) : ('awaiting' as const),
    })), [filtered])

  const resetFilters = () => {
    setRadiusKm(25)
    setMode('all')
    setCategory('')
    setStrength('')
    setBookableOnly(false)
    setQuery('')
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Location is not available in this browser. Place a travel pin instead.')
      return
    }
    setLocationStatus('Finding your current location...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setOriginMode('device')
        setLocationStatus(`Showing approved Companions within ${radiusKm} km.`)
      },
      (error) => setLocationStatus(geolocationErrorMessage(error.code)),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  const beginTravelPin = () => {
    setOriginMode('custom')
    setLocationStatus(location
      ? 'Click or drag the map to reposition your travel pin.'
      : 'Click the map to place your travel pin.')
  }

  return (
    <main className="nearby-search-page">
      <header className="nearby-search-header">
        <div className="nearby-search-titlebar">
          <Link to="/discover" className="nearby-search-back">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Explore</span>
          </Link>
          <div className="nearby-search-heading">
            <p className="eyebrow">Explore nearby</p>
            <h1>Search nearby</h1>
            <p role="status" aria-live="polite">{locationStatus}</p>
          </div>
          <div className="nearby-search-origin-actions">
            <button type="button" className="btn btn-social btn-sm" onClick={useCurrentLocation}>
              <LocateFixed size={15} aria-hidden="true" />
              Use my location
            </button>
            <button type="button" className="btn btn-neutral btn-sm" onClick={beginTravelPin}>
              <MapPin size={15} aria-hidden="true" />
              Place a pin
            </button>
          </div>
        </div>

        <div className="nearby-search-filterbar" role="region" aria-label="Nearby search filters">
          <div className="nearby-filter-search">
            <SearchField
              label="Search nearby Companions"
              value={query}
              onChange={setQuery}
              placeholder="Search people or activities"
            />
          </div>

          <label className="nearby-filter-field">
            <span>Radius</span>
            <select
              aria-label="Nearby radius"
              value={radiusKm}
              onChange={(event) => {
                const next = Number(event.currentTarget.value) as NearbyRadiusKm
                setRadiusKm(next)
                if (location) setLocationStatus(`Showing approved Companions within ${next} km.`)
              }}
            >
              {nearbyRadiusOptions.map((value) => <option key={value} value={value}>{value} km</option>)}
            </select>
          </label>

          <label className="nearby-filter-field">
            <span>Mode</span>
            <select aria-label="Session mode" value={mode} onChange={(event) => setMode(event.currentTarget.value as ModeFilter)}>
              <option value="all">Any mode</option>
              <option value="online">Online</option>
              <option value="in_person">In-person</option>
              <option value="both">Both</option>
            </select>
          </label>

          <label className="nearby-filter-field">
            <span>Things to do</span>
            <select aria-label="Things to do" value={category} onChange={(event) => setCategory(event.currentTarget.value)}>
              <option value="">Everything</option>
              {categories.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="nearby-filter-field">
            <span>Strengths</span>
            <select aria-label="Strengths" value={strength} onChange={(event) => setStrength(event.currentTarget.value)}>
              <option value="">Any Strength</option>
              {friendStrengths.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="nearby-available-toggle">
            <input
              type="checkbox"
              aria-label="Available to book"
              checked={bookableOnly}
              onChange={(event) => setBookableOnly(event.currentTarget.checked)}
            />
            <span>Available</span>
          </label>

          <button type="button" className="nearby-filter-reset" onClick={resetFilters}>
            <RotateCcw size={14} aria-hidden="true" />
            Reset
          </button>
        </div>
      </header>

      <div className="nearby-search-workspace">
        <section className="nearby-search-map" aria-label="Nearby map">
          <ApproximateLocationMap
            location={location}
            radiusKm={radiusKm}
            tone="social"
            pinnable={originMode === 'custom'}
            people={location ? mapPeople : []}
            onSelectPerson={(key) => navigate({ to: '/companion-profile', search: { companionProfileId: key } })}
            onChange={(next) => {
              setLocation(next)
              setOriginMode('custom')
              setLocationStatus(`Travel pin updated. Showing approved Companions within ${radiusKm} km.`)
            }}
            title={location
              ? `${originMode === 'device' ? 'Current location' : 'Travel pin'} · ${radiusKm} km`
              : 'Choose a search area'}
            description={location
              ? 'Locations are approximate. Select a person to review their full profile.'
              : 'Use your location or place a pin. Your search origin stays in this browser session.'}
          />
        </section>

        <aside className="nearby-search-results" aria-label="Nearby Companions">
          <header>
            <div>
              <p className="eyebrow">Results</p>
              <h2>{location ? `${filtered.length} ${filtered.length === 1 ? 'person' : 'people'}` : 'Choose an area'}</h2>
            </div>
            {location && <span>{radiusKm} km</span>}
          </header>

          {!location ? (
            <EmptyState
              icon={<MapPin size={20} aria-hidden="true" />}
              title="Start with an area"
              description="Use your location or place a travel pin. Approved Companions with current identity approval can appear."
            />
          ) : companionsQuery === undefined ? (
            <EmptyState title="Finding nearby people..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No matches here yet"
              description="Try a larger radius or reset a filter."
            />
          ) : (
            <div className="nearby-results-list">
              {filtered.map((companion) => (
                <CompanionListItem
                  key={companion._id}
                  companion={{ ...companion, kind: 'companion' } as DiscoveryCompanion}
                  signedIn={Boolean(isSignedIn)}
                  profileLink={Link}
                  profileLinkProps={{ to: '/companion-profile', search: { companionProfileId: companion._id } }}
                  onFollow={async () => {
                    if (!companion.userId) return
                    await toggleFollow({ userId: companion.userId as any })
                  }}
                />
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
