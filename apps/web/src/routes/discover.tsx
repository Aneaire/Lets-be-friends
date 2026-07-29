import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, SlidersHorizontal, X } from 'lucide-react'
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
  demo?: boolean
  saved?: boolean
  following?: boolean
  userId?: string
  profileImageUrl?: string
  distanceKm?: number
}

type ModeFilter = 'all' | 'online' | 'in_person' | 'both'

function DiscoverPage() {
  const { isSignedIn } = useAuth()
  const [nearby, setNearby] = useState<{ latitude: number; longitude: number } | null>(null)
  const [radiusKm, setRadiusKm] = useState(25)
  const [locationStatus, setLocationStatus] = useState('')
  const hosts = (useQuery(api.hosts.listApproved, nearby ? { ...nearby, radiusKm } : {}) ?? []) as DiscoveryHost[]
  const toggleSaveProfile = useMutation(api.hosts.toggleSaveProfile)
  const toggleFollow = useMutation(api.social.toggleFollow)
  const [mode, setMode] = useState<ModeFilter>('all')
  const [category, setCategory] = useState<string | null>(null)
  const [strength, setStrength] = useState<string | null>(null)
  const [bookableOnly, setBookableOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const categoryStripRef = useRef<HTMLDivElement>(null)
  const categoryWrapRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    return hosts.filter((host) => {
      if (mode !== 'all' && host.mode !== mode && !(mode === 'online' && host.mode === 'both')) return false
      if (category && !(host.categories ?? []).includes(category)) return false
      if (strength && !host.strengths.includes(strength)) return false
      if (bookableOnly && !host.bookable) return false
      return true
    })
  }, [hosts, mode, category, strength, bookableOnly])

  const verifiedCount = filtered.filter((host) => host.bookable && !host.demo).length
  const demoCount = filtered.length - verifiedCount
  const moreFilterCount = (strength ? 1 : 0) + (nearby ? 1 : 0)
  const anyFiltered = mode !== 'all' || category !== null || strength !== null || bookableOnly || nearby !== null

  const clearAllFilters = () => {
    setMode('all')
    setCategory(null)
    setStrength(null)
    setBookableOnly(false)
    setNearby(null)
    setLocationStatus('')
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
    <main className="marketing-page-wide">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <p className="eyebrow">Discovery</p>
          <h1 className="text-h1 mt-2">Find a Friend Host</h1>
          <p className="lede mt-2">
            Approved hosts only. Demo profiles fill the page while the review queue is empty.
          </p>
        </div>
        <p className="text-meta tabular">
          {filtered.length} {filtered.length === 1 ? 'profile' : 'profiles'}
          {demoCount > 0 && <span className="soft"> · {verifiedCount} bookable · {demoCount} demo</span>}
        </p>
      </header>

      <div className="discover-toolbar" role="region" aria-label="Filters">
        <div className="discover-toolbar-primary">
          <div className="mode-pillgroup" role="tablist" aria-label="Mode">
            <ModeChip value="all" current={mode} onChange={setMode}>Any</ModeChip>
            <ModeChip value="online" current={mode} onChange={setMode}>Online</ModeChip>
            <ModeChip value="in_person" current={mode} onChange={setMode}>In-person</ModeChip>
            <ModeChip value="both" current={mode} onChange={setMode}>Either</ModeChip>
          </div>
          <div className="discover-toolbar-trailing">
            <label className="bookable-toggle">
              <input
                type="checkbox"
                checked={bookableOnly}
                onChange={(event) => setBookableOnly(event.currentTarget.checked)}
              />
              <span>Bookable only</span>
            </label>
            <button
              type="button"
              className="btn btn-neutral btn-sm filters-trigger"
              onClick={() => setCategoriesOpen(true)}
              aria-expanded={categoriesOpen}
              aria-controls="categories-dialog"
            >
              <LayoutGrid size={14} aria-hidden="true" />
              <span>Categories</span>
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
              <span>More filters</span>
              {moreFilterCount > 0 && <span className="filters-trigger-badge tabular">{moreFilterCount}</span>}
            </button>
          </div>
        </div>

        <div className="category-strip-wrap" ref={categoryWrapRef} data-start="true" data-end="false">
          <div className="category-strip" ref={categoryStripRef} role="tablist" aria-label="Activity category">
            <ToggleChip selected={category === null} onClick={() => setCategory(null)}>Any category</ToggleChip>
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

      <section aria-label="Results" className="mt-5">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No matches with these filters.</p>
            <p className="text-meta">Loosen a filter or clear all to see every approved host.</p>
          </div>
        ) : (
          <div className="panel">
            <div className="worklist" role="list">
              {filtered.map((host) => (
                <HostRow
                  key={host._id}
                  host={host}
                  signedIn={Boolean(isSignedIn)}
                  onSave={async () => {
                    if (!host.bookable || host.demo) return
                    await toggleSaveProfile({ hostProfileId: host._id as any })
                  }}
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
                <p className="eyebrow">Filter</p>
                <h2 id="categories-dialog-title" className="text-h2 mt-1">Activity categories</h2>
              </div>
              <button
                type="button"
                className="social-icon-button"
                aria-label="Close categories"
                onClick={() => setCategoriesOpen(false)}
              >
                <X size={16} />
              </button>
            </header>
            <div className="categories-dialog-body">
              <div className="filter-section-row">
                <ToggleChip selected={category === null} onClick={() => setCategory(null)}>Any category</ToggleChip>
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
                <p className="eyebrow">Filters</p>
                <h2 id="discover-filters-title" className="text-h2 mt-1">More filters</h2>
              </div>
              <button
                type="button"
                className="social-icon-button"
                aria-label="Close filters"
                onClick={() => setFiltersOpen(false)}
              >
                <X size={16} />
              </button>
            </header>

            <div className="filters-drawer-body">
              <FilterSection title="Strength">
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

              <FilterSection title="Near me">
                <div className="flex flex-col gap-3 w-full">
                  <label className="field-row">
                    <span className="label">Distance radius</span>
                    <select className="field" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.currentTarget.value))}>
                      <option value={5}>5 km</option>
                      <option value={10}>10 km</option>
                      <option value={25}>25 km</option>
                      <option value={50}>50 km</option>
                      <option value={100}>100 km</option>
                    </select>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-social btn-sm"
                      onClick={() => {
                        if (!navigator.geolocation) {
                          setLocationStatus('Location is not available in this browser.')
                          return
                        }
                        setLocationStatus('Asking for your approximate location…')
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            setNearby({
                              latitude: position.coords.latitude,
                              longitude: position.coords.longitude,
                            })
                            setLocationStatus(`Showing nearby in-person hosts within ${radiusKm} km. Online-only hosts appear after nearby matches.`)
                          },
                          () => setLocationStatus('Location permission was not granted.'),
                          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
                        )
                      }}
                    >
                      Use my location
                    </button>
                    {nearby && (
                      <button type="button" className="btn btn-neutral btn-sm" onClick={() => { setNearby(null); setLocationStatus('Near-me filter cleared.') }}>
                        Clear
                      </button>
                    )}
                  </div>
                  {locationStatus && <p className="text-meta">{locationStatus}</p>}
                </div>
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

function HostRow({ host, signedIn, onSave, onFollow }: { host: DiscoveryHost; signedIn: boolean; onSave: () => Promise<void>; onFollow: () => Promise<void> }) {
  return (
    <article className="worklist-row" role="listitem">
      <div className="worklist-row-head">
        <div className="flex items-start gap-3 min-w-0">
          <ProfilePhoto imageUrl={host.profileImageUrl} name={host.displayName} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-h3">{host.displayName}</h2>
              <TrustChip state={host.demo ? 'demo' : host.bookable ? 'verified' : 'awaiting'} />
            </div>
            <div className="worklist-row-meta mt-1">
              <span>{host.city}</span>
              {typeof host.distanceKm === 'number' && (
                <>
                  <span className="dot" aria-hidden="true" />
                  <span>{host.distanceKm} km away</span>
                </>
              )}
              <span className="dot" aria-hidden="true" />
              <span>{formatMode(host.mode)}</span>
              <span className="dot" aria-hidden="true" />
              <span className="tabular" aria-label={`${host.rating.toFixed(1)} out of 5 stars`}>
                {host.rating.toFixed(1)}★ · {host.reviewCount ?? 0} {(host.reviewCount ?? 0) === 1 ? 'review' : 'reviews'}
              </span>
              {host.strengths.length > 0 && (
                <>
                  <span className="dot" aria-hidden="true" />
                  <span className="truncate max-w-[44ch]">
                    {host.strengths.slice(0, 4).join(' · ')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0">
          {host.bookable ? (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Link to="/host-profile" search={{ hostProfileId: host._id }} className="btn btn-neutral btn-sm">
                View profile
              </Link>
              {host.viewerCanBook === false ? (
                <span className="status-pill" data-tone="self">Your profile</span>
              ) : (
                <>
                  <Link to="/app" search={{ hostProfileId: host._id }} className="btn btn-social btn-sm">
                    Request booking
                  </Link>
                  {signedIn && (
                    <>
                      <button onClick={onFollow} className="btn btn-social-quiet btn-sm">{host.following ? 'Following' : 'Follow'}</button>
                      <button onClick={onSave} className="btn btn-neutral btn-sm">{host.saved ? 'Saved' : 'Save'}</button>
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <span className="text-meta">Not bookable yet</span>
          )}
        </div>
      </div>
      <p className="text-body muted max-w-[68ch]">{host.intro}</p>
    </article>
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
      onClick={() => onChange(value)}
    >
      {children}
    </button>
  )
}

function ToggleChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="chip" data-selected={selected} onClick={onClick}>
      {children}
    </button>
  )
}

function TrustChip({ state }: { state: 'verified' | 'awaiting' | 'demo' }) {
  const label = state === 'verified' ? 'Verified' : state === 'awaiting' ? 'Awaiting review' : 'Demo'
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
