import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Heart, LayoutGrid, MapPin, Search, SlidersHorizontal, Star, X } from 'lucide-react'
import { activityCategories, friendStrengths } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/discover')({ component: DiscoverPage })

type DiscoveryHost = {
  _id: string
  displayName: string
  city: string
  mode: 'online' | 'in_person' | 'both'
  rating: number
  reviewCount?: number
  intro: string
  strengths: string[]
  categories?: string[]
  bookable?: boolean
  viewerCanBook?: boolean
  viewerBookingEligibility?: 'eligible' | 'sign_in_required' | 'verification_required' | 'own_profile'
  demo?: boolean
  saved?: boolean
  following?: boolean
  userId?: string
  profileImageUrl?: string
  distanceKm?: number
  latitude?: number
  longitude?: number
  bio?: string
}

type ModeFilter = 'all' | 'online' | 'in_person' | 'both'

function DiscoverPage() {
  const { isSignedIn } = useAuth()
  const hosts = (useQuery(api.hosts.listApproved, {}) ?? []) as DiscoveryHost[]
  const toggleFollow = useMutation(api.social.toggleFollow)
  const [mode, setMode] = useState<ModeFilter>('all')
  const [category, setCategory] = useState<string | null>(null)
  const [strength, setStrength] = useState<string | null>(null)
  const [bookableOnly, setBookableOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const categoryStripRef = useRef<HTMLDivElement>(null)
  const categoryWrapRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const searchTerm = query.trim().toLowerCase()
    return hosts.filter((host) => {
      if (mode !== 'all' && host.mode !== mode && !(mode === 'online' && host.mode === 'both')) return false
      if (category && !(host.categories ?? []).includes(category)) return false
      if (strength && !host.strengths.includes(strength)) return false
      if (bookableOnly && !host.bookable) return false
      if (searchTerm) {
        const haystack = [
          host.displayName,
          host.city,
          host.intro,
          host.bio ?? '',
          ...(host.strengths ?? []),
          ...(host.categories ?? []),
        ].join(' ').toLowerCase()
        if (!haystack.includes(searchTerm)) return false
      }
      return true
    })
  }, [hosts, mode, category, strength, bookableOnly, query])

  const verifiedCount = filtered.filter((host) => host.bookable && !host.demo).length
  const demoCount = filtered.length - verifiedCount
  const moreFilterCount = strength ? 1 : 0
  const anyFiltered = mode !== 'all' || category !== null || strength !== null || bookableOnly || query.trim() !== ''

  const clearAllFilters = () => {
    setMode('all')
    setCategory(null)
    setStrength(null)
    setBookableOnly(false)
    setQuery('')
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (filtersOpen) setFiltersOpen(false)
      if (categoriesOpen) setCategoriesOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [filtersOpen, categoriesOpen])

  useEffect(() => {
    const strip = categoryStripRef.current
    const wrap = categoryWrapRef.current
    if (!strip || !wrap) return
    const update = () => {
      wrap.dataset.start = String(strip.scrollLeft <= 1)
      wrap.dataset.end = String(strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2)
    }
    update()
    strip.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(strip)
    return () => {
      strip.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    const el = categoryStripRef.current
    if (!el) return

    let startX = 0
    let startScroll = 0
    let active = false
    let hasDragged = false
    let rafId = 0
    const samples: { x: number; t: number }[] = []

    const cancelMomentum = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    }

    const applyMomentum = (velocity: number) => {
      const tick = () => {
        el.scrollLeft += velocity
        velocity *= 0.92
        rafId = Math.abs(velocity) > 0.5 ? requestAnimationFrame(tick) : 0
      }
      rafId = requestAnimationFrame(tick)
    }

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      cancelMomentum()
      active = true
      hasDragged = false
      startX = event.clientX
      startScroll = el.scrollLeft
      samples.length = 0
      event.preventDefault()
    }

    const onMouseMove = (event: MouseEvent) => {
      if (!active) return
      const now = performance.now()
      samples.push({ x: event.clientX, t: now })
      if (samples.length > 6) samples.shift()
      const dx = event.clientX - startX
      if (Math.abs(dx) > 4) {
        hasDragged = true
        el.dataset.dragging = 'true'
      }
      if (hasDragged) el.scrollLeft = startScroll - dx
    }

    const onMouseUp = () => {
      if (!active) return
      active = false
      delete el.dataset.dragging

      if (hasDragged) {
        // Calculate velocity from recent samples (ignore stale ones)
        const recent = samples.filter((s) => performance.now() - s.t < 100)
        if (recent.length >= 2) {
          const first = recent[0]
          const last = recent[recent.length - 1]
          const dt = last.t - first.t
          if (dt > 0) {
            const velocity = ((first.x - last.x) / dt) * 16
            if (Math.abs(velocity) > 1) applyMomentum(velocity)
          }
        }

        const absorb = (e: MouseEvent) => {
          e.stopPropagation()
          e.preventDefault()
          el.removeEventListener('click', absorb, true)
        }
        el.addEventListener('click', absorb, true)
      }
      hasDragged = false
    }

    el.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      cancelMomentum()
      el.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <main className="marketing-page-wide discover-page">
      <header className="discover-page-header">
        <div>
          <h1 className="text-h1">Explore people</h1>
          <p className="text-meta mt-1">Search by activity, Strength, city, or name.</p>
        </div>
        <p className="text-meta tabular">
          {filtered.length} {filtered.length === 1 ? 'person' : 'people'}
          {demoCount > 0 && <span className="soft"> · {verifiedCount} available · {demoCount} preview</span>}
        </p>
      </header>

      <div className="discover-toolbar" role="region" aria-label="Filters">
        <div className="discover-toolbar-primary">
          <div className="discover-search" role="search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              className="discover-search-input"
              placeholder="Search by name, city, or activity"
              aria-label="Search Friend Hosts"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            {query && (
              <button type="button" className="discover-search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="mode-pillgroup" role="group" aria-label="Mode">
            <ModeChip value="all" current={mode} onChange={setMode}>Anywhere</ModeChip>
            <ModeChip value="online" current={mode} onChange={setMode}>Online</ModeChip>
            <ModeChip value="in_person" current={mode} onChange={setMode}>In-person</ModeChip>
            <ModeChip value="both" current={mode} onChange={setMode}>Both</ModeChip>
          </div>
          <div className="discover-toolbar-trailing">
            <label className="bookable-toggle">
              <input
                type="checkbox"
                checked={bookableOnly}
                onChange={(event) => setBookableOnly(event.currentTarget.checked)}
              />
              <span>Available to book</span>
            </label>
            <button
              type="button"
              className="btn btn-neutral btn-sm filters-trigger"
              onClick={() => setCategoriesOpen(true)}
              aria-expanded={categoriesOpen}
              aria-controls="categories-dialog"
            >
              <LayoutGrid size={14} aria-hidden="true" />
              <span>Things to do</span>
              {category !== null && <span className="filters-trigger-badge tabular">1</span>}
            </button>
            <button
              type="button"
              className="btn btn-neutral btn-sm filters-trigger"
              onClick={() => setFiltersOpen(true)}
              aria-expanded={filtersOpen}
              aria-controls="discover-filters-drawer"
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span>Strengths</span>
              {moreFilterCount > 0 && <span className="filters-trigger-badge tabular">{moreFilterCount}</span>}
            </button>
          </div>
        </div>

        <div className="category-strip-wrap" ref={categoryWrapRef} data-start="true" data-end="false">
          <div className="category-strip" ref={categoryStripRef} role="group" aria-label="Activity category">
            <ToggleChip selected={category === null} onClick={() => setCategory(null)}>Everything</ToggleChip>
            {activityCategories.map((value) => (
              <ToggleChip
                key={value}
                selected={category === value}
                onClick={() => setCategory(category === value ? null : value)}
              >
                {value}
              </ToggleChip>
            ))}
          </div>
        </div>

        {anyFiltered && (
          <div className="discover-toolbar-active">
            <span className="text-meta">Active filters</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearAllFilters}>
              Clear all
            </button>
          </div>
        )}
      </div>

      <section className="nearby-search-entry" aria-labelledby="nearby-search-entry-title">
        <div>
          <span className="eyebrow">Nearby is optional</span>
          <h2 id="nearby-search-entry-title">Looking for someone close by?</h2>
          <p>Open a dedicated map workspace to choose an area, adjust filters, and review opted-in Friend Hosts.</p>
        </div>
        <Link to="/nearby" className="btn btn-social btn-sm">
          <MapPin size={14} aria-hidden="true" />
          Open nearby search
        </Link>
      </section>

      <section aria-label="Results" className="mt-5">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No matches with these filters.</p>
            <p className="text-meta">Try another activity or clear the filters to see everyone.</p>
          </div>
        ) : (
          <div className="panel">
            <div className="worklist" role="list">
              {filtered.map((host) => (
                <HostRow
                  key={host._id}
                  host={host}
                  signedIn={Boolean(isSignedIn)}
                  onFollow={async () => {
                    if (!host.userId) return
                    await toggleFollow({ userId: host.userId as any })
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {categoriesOpen && (
        <div
          className="filters-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCategoriesOpen(false)
          }}
        >
          <div
            id="categories-dialog"
            className="categories-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="categories-dialog-title"
          >
            <header className="filters-drawer-header">
              <div>
                <p className="eyebrow">Things to do</p>
                <h2 id="categories-dialog-title" className="text-h2 mt-1">Choose an activity</h2>
              </div>
              <button
                type="button"
                className="social-icon-button"
                aria-label="Close Things to do"
                onClick={() => setCategoriesOpen(false)}
              >
                <X size={16} />
              </button>
            </header>
            <div className="categories-dialog-body">
              <div className="filter-section-row">
                <ToggleChip selected={category === null} onClick={() => setCategory(null)}>Everything</ToggleChip>
                {activityCategories.map((value) => (
                  <ToggleChip
                    key={value}
                    selected={category === value}
                    onClick={() => setCategory(category === value ? null : value)}
                  >
                    {value}
                  </ToggleChip>
                ))}
              </div>
            </div>
            <footer className="filters-drawer-footer">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCategory(null)}>
                Clear
              </button>
              <button type="button" className="btn btn-self btn-sm" onClick={() => setCategoriesOpen(false)}>
                Show {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {filtersOpen && (
        <div
          className="filters-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFiltersOpen(false)
          }}
        >
          <aside
            id="discover-filters-drawer"
            className="filters-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discover-filters-title"
          >
            <header className="filters-drawer-header">
              <div>
                <p className="eyebrow">Strengths</p>
                <h2 id="discover-filters-title" className="text-h2 mt-1">What someone brings</h2>
              </div>
              <button
                type="button"
                className="social-icon-button"
                aria-label="Close Strengths"
                onClick={() => setFiltersOpen(false)}
              >
                <X size={16} />
              </button>
            </header>

            <div className="filters-drawer-body">
              <FilterSection title="Choose a Strength">
                <ToggleChip selected={strength === null} onClick={() => setStrength(null)}>Any</ToggleChip>
                {friendStrengths.map((value) => (
                  <ToggleChip
                    key={value}
                    selected={strength === value}
                    onClick={() => setStrength(strength === value ? null : value)}
                  >
                    {value}
                  </ToggleChip>
                ))}
              </FilterSection>
            </div>

            <footer className="filters-drawer-footer">
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearAllFilters}>
                Clear all
              </button>
              <button type="button" className="btn btn-self btn-sm" onClick={() => setFiltersOpen(false)}>
                Show {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </main>
  )
}

function HostRow({ host, signedIn, onFollow }: { host: DiscoveryHost; signedIn: boolean; onFollow: () => Promise<void> }) {
  const hasDistance = typeof host.distanceKm === 'number'

  return (
    <article className="discover-host-row" data-nearby={hasDistance} role="listitem">
      <div className="discover-host-avatar">
        <Link
          to="/host-profile"
          search={{ hostProfileId: host._id }}
          className="discover-host-avatar-link"
          aria-label={`View ${host.displayName}'s profile`}
        >
          <ProfilePhoto imageUrl={host.profileImageUrl} name={host.displayName} size="lg" />
        </Link>
      </div>

      <div className="discover-host-main">
        <header className="discover-host-identity">
          <div className="discover-host-name-row">
            <h2>
              <Link
                to="/host-profile"
                search={{ hostProfileId: host._id }}
                className="discover-host-name-link"
              >
                <span>{host.displayName}</span>
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            </h2>
            <TrustChip state={host.demo ? 'demo' : host.bookable ? 'verified' : 'awaiting'} />
          </div>
          <div className="discover-host-context">
            <span>{host.city}</span>
            <span aria-hidden="true">/</span>
            <span>{formatMode(host.mode)}</span>
          </div>
        </header>

        <p className="discover-host-intro">{host.intro}</p>

        {host.strengths.length > 0 && (
          <ul className="discover-host-strengths" aria-label={`${host.displayName}'s Strengths`}>
            {host.strengths.slice(0, 3).map((strength) => <li key={strength}>{strength}</li>)}
          </ul>
        )}

        <div className="discover-host-mobile-facts">
          {hasDistance && <DistanceStamp distanceKm={host.distanceKm!} compact />}
          <RatingSummary rating={host.rating} reviewCount={host.reviewCount ?? 0} />
        </div>
      </div>

      <aside className="discover-host-side" aria-label={`Actions and proximity for ${host.displayName}`}>
        <div className="discover-host-desktop-facts">
          {hasDistance && <DistanceStamp distanceKm={host.distanceKm!} />}
          <RatingSummary rating={host.rating} reviewCount={host.reviewCount ?? 0} />
        </div>

        <div className="discover-host-actions">
          <Link to="/host-profile" search={{ hostProfileId: host._id }} className="btn btn-social btn-sm">
            View fit and ideas
          </Link>
          {signedIn ? (
            <button
              type="button"
              onClick={onFollow}
              className="btn btn-social-quiet btn-sm"
              data-active={host.following}
              disabled={!host.userId || host.viewerBookingEligibility === 'own_profile'}
            >
              <Heart size={14} fill={host.following ? 'currentColor' : 'none'} aria-hidden="true" />
              {host.following ? 'Following' : 'Follow'}
            </button>
          ) : (
            <SignInButton mode="modal">
              <button type="button" className="btn btn-social-quiet btn-sm">
                <Heart size={14} aria-hidden="true" />
                Follow
              </button>
            </SignInButton>
          )}
        </div>
      </aside>
    </article>
  )
}

function DistanceStamp({ distanceKm, compact = false }: { distanceKm: number; compact?: boolean }) {
  return (
    <div className="discover-host-distance" data-compact={compact} aria-label={`${distanceKm} kilometers away`}>
      <span>Nearby</span>
      <strong className="tabular">{distanceKm}</strong>
      <small>km away</small>
    </div>
  )
}

function RatingSummary({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  return (
    <div className="discover-host-rating">
      <Star size={14} fill="currentColor" aria-hidden="true" />
      <strong className="tabular" aria-label={`${rating.toFixed(1)} out of 5 stars`}>{rating.toFixed(1)}</strong>
      <span>·</span>
      <span className="tabular">{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span>
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="filter-section">
      <p className="filter-section-title">{title}</p>
      <div className="filter-section-row">{children}</div>
    </div>
  )
}

function ModeChip<T extends ModeFilter>({
  value,
  current,
  onChange,
  children,
}: {
  value: T
  current: T
  onChange: (next: T) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className="chip"
      data-selected={current === value}
      aria-pressed={current === value}
      onClick={() => onChange(value)}
    >
      {children}
    </button>
  )
}

function ToggleChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="chip" data-selected={selected} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  )
}

function TrustChip({ state }: { state: 'verified' | 'awaiting' | 'demo' }) {
  const label = state === 'verified' ? 'Identity checked' : state === 'awaiting' ? 'Review in progress' : 'Preview profile'
  return (
    <span className="trust-chip" data-state={state}>
      <span className="trust-chip-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

function ProfilePhoto({ imageUrl, name, size }: { imageUrl?: string; name: string; size?: 'lg' }) {
  const className = size === 'lg' ? 'profile-photo profile-photo-lg' : 'profile-photo'
  return (
    <span className={className} aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" /> : <span>{initials(name)}</span>}
    </span>
  )
}

function formatMode(mode: DiscoveryHost['mode']) {
  if (mode === 'both') return 'Online and in-person'
  if (mode === 'in_person') return 'In-person'
  return 'Online'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
