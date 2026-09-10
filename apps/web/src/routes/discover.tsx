import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@clerk/react'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { LayoutGrid, SlidersHorizontal, X } from 'lucide-react'
import { activityCategoriesMatch, activityCategoryOptions, friendStrengths } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { Checkbox } from '../design-system/atoms/Field'
import { SearchField } from '../design-system/molecules/SearchField'
import { SegmentedControl } from '../design-system/molecules/SegmentedControl'
import { CompanionListItem, type DiscoveryCompanion } from '../design-system/organisms/CompanionListItem'
import { CategoryFilterDialog } from '../features/discovery/CategoryFilterDialog'

export const Route = createFileRoute('/discover')({ component: DiscoverPage })

type ModeFilter = 'all' | 'online' | 'in_person' | 'both'

export function DiscoverPage() {
  const { isSignedIn } = useAuth()
  const {
    results: directoryResults,
    status: directoryStatus,
    loadMore: loadMoreDirectory,
  } = usePaginatedQuery(api.companions.listExploreDirectoryPage, {}, { initialNumItems: 50 })
  const companions = (directoryResults ?? []) as DiscoveryCompanion[]
  const toggleFollow = useMutation(api.social.toggleFollow)
  const [mode, setMode] = useState<ModeFilter>('all')
  const [category, setCategory] = useState<string | null>(null)
  const [strength, setStrength] = useState<string | null>(null)
  const [bookableOnly, setBookableOnly] = useState(false)
  const [reviewsOnly, setReviewsOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const categories = useMemo(
    () => activityCategoryOptions(...companions.map((companion) => companion.categories)),
    [companions],
  )

  const filtered = useMemo(() => {
    const searchTerm = query.trim().toLowerCase()
    return companions.filter((companion) => {
      if (mode !== 'all' && (companion.kind !== 'companion' || (companion.mode !== mode && !(mode === 'online' && companion.mode === 'both')))) return false
      if (category && !(companion.categories ?? []).some((value) => activityCategoriesMatch(value, category))) return false
      if (strength && (companion.kind !== 'companion' || !companion.strengths.includes(strength))) return false
      if (bookableOnly && !companion.bookable) return false
      if (reviewsOnly && (companion.kind === 'member' || (companion.reviewCount ?? 0) < 1)) return false
      if (searchTerm) {
        const haystack = [
          companion.displayName,
          companion.city,
          companion.intro,
          companion.bio ?? '',
          ...(companion.strengths ?? []),
          ...(companion.categories ?? []),
        ].join(' ').toLowerCase()
        if (!haystack.includes(searchTerm)) return false
      }
      return true
    })
  }, [companions, mode, category, strength, bookableOnly, reviewsOnly, query])

  const moreFilterCount = strength ? 1 : 0
  const anyFiltered = mode !== 'all' || category !== null || strength !== null || bookableOnly || reviewsOnly || query.trim() !== ''

  const clearAllFilters = () => {
    setMode('all')
    setCategory(null)
    setStrength(null)
    setBookableOnly(false)
    setReviewsOnly(false)
    setQuery('')
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (filtersOpen) setFiltersOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [filtersOpen])

  return (
    <main className="marketing-page-wide discover-page">
      <nav className="discover-destination-nav" aria-label="Explore destinations">
        <Link
          to="/discover"
          className="discover-destination-link"
          aria-current={reviewsOnly ? undefined : 'page'}
          onClick={() => setReviewsOnly(false)}
        >
          People
        </Link>
        <Link to="/circles" className="discover-destination-link">Circles</Link>
        <Link to="/nearby" className="discover-destination-link">Nearby</Link>
        <a
          href="#reviews"
          className="discover-destination-link"
          aria-current={reviewsOnly ? 'location' : undefined}
          data-active={reviewsOnly || undefined}
          onClick={() => setReviewsOnly(true)}
        >
          Reviews
        </a>
      </nav>

      <div className="discover-toolbar" role="region" aria-label="Filters">
        <div className="discover-toolbar-primary">
          <SearchField
            className="discover-search-field"
            label="Search people"
            value={query}
            onChange={setQuery}
            placeholder="Search by name, city, or activity"
          />
          <SegmentedControl
            className="mode-pillgroup"
            label="Session format"
            options={[
              { value: 'all', label: 'Anywhere' },
              { value: 'online', label: 'Online' },
              { value: 'in_person', label: 'In-person' },
              { value: 'both', label: 'Both' },
            ]}
            value={mode}
            onChange={setMode}
            tone="social"
          />
          <div className="discover-toolbar-trailing">
            <Checkbox
              className="bookable-toggle"
              label="Available to book"
              checked={bookableOnly}
              onChange={(event) => setBookableOnly(event.currentTarget.checked)}
            />
            <button
              type="button"
              className="btn btn-neutral btn-sm filters-trigger"
              onClick={() => setCategoriesOpen(true)}
              aria-expanded={categoriesOpen}
            >
              <LayoutGrid size={14} aria-hidden="true" />
              <span className="filters-trigger-label">{category ?? 'Everyday help'}</span>
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

        {anyFiltered && (
          <div className="discover-toolbar-active">
            <span className="text-meta">Active filters</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearAllFilters}>
              Clear all
            </button>
          </div>
        )}
      </div>

      <section id="reviews" aria-label="Results" className="discover-results mt-5">
        {directoryStatus === 'LoadingFirstPage' ? (
          <div className="empty-state">
            <p className="empty-state-title">Loading people...</p>
          </div>
        ) : filtered.length === 0 && directoryStatus !== 'CanLoadMore' ? (
          <div className="empty-state">
            <p className="empty-state-title">No matches with these filters.</p>
            <p className="text-meta">Try another activity or clear the filters to see everyone.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No matches in the people loaded so far.</p>
            <p className="text-meta">Load more people or clear the filters to see everyone loaded.</p>
          </div>
        ) : (
          <div className="panel discover-results-panel">
            <div className="worklist" role="list">
              {filtered.map((companion) => (
                <CompanionListItem
                  key={companion._id}
                  companion={companion}
                  signedIn={Boolean(isSignedIn)}
                  profileLink={Link}
                  profileLinkProps={companion.kind !== 'member'
                    ? { to: '/companion-profile', search: { companionProfileId: companion._id } }
                    : { to: '/member-profile', search: { userId: companion.userId } }}
                  onFollow={async () => {
                    if (!companion.userId) return
                    await toggleFollow({ userId: companion.userId as any })
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {directoryStatus === 'CanLoadMore' && (
          <div className="discover-load-more">
            <button type="button" className="btn btn-neutral btn-sm" onClick={() => loadMoreDirectory(50)}>
              Load more people
            </button>
          </div>
        )}
        {directoryStatus === 'LoadingMore' && (
          <p className="text-meta tabular mt-3" role="status">Loading more people...</p>
        )}
      </section>

      <CategoryFilterDialog
        open={categoriesOpen}
        categories={categories}
        selectedCategory={category}
        resultCount={filtered.length}
        onChange={setCategory}
        onClose={() => setCategoriesOpen(false)}
      />

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
              <button type="button" className="btn btn-social btn-sm" onClick={() => setFiltersOpen(false)}>
                Show {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </main>
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

function ToggleChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="chip" data-selected={selected} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  )
}
