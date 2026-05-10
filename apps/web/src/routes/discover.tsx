import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { activityCategories, friendStrengths } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/discover')({ component: DiscoverPage })

type DiscoveryHost = {
  _id: string
  displayName: string
  city: string
  mode: 'online' | 'in_person' | 'both'
  rating: number
  intro: string
  strengths: string[]
  categories?: string[]
  bookable?: boolean
  demo?: boolean
}

type ModeFilter = 'all' | 'online' | 'in_person' | 'both'

function DiscoverPage() {
  const hosts = (useQuery(api.hosts.listApproved) ?? []) as DiscoveryHost[]
  const [mode, setMode] = useState<ModeFilter>('all')
  const [category, setCategory] = useState<string | null>(null)
  const [strength, setStrength] = useState<string | null>(null)
  const [bookableOnly, setBookableOnly] = useState(false)

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

  return (
    <main className="marketing-page-wide">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <p className="eyebrow">Discovery</p>
          <h1 className="text-h1 mt-2">Find a Friend Host</h1>
          <p className="lede mt-2">
            Approved hosts only. Demo profiles fill the page while admin review is empty.
          </p>
        </div>
        <p className="text-meta tabular">
          {filtered.length} {filtered.length === 1 ? 'profile' : 'profiles'}
          {demoCount > 0 && <span className="soft"> · {verifiedCount} bookable · {demoCount} demo</span>}
        </p>
      </header>

      <div className="discover-grid">
        <aside className="filter-rail" aria-label="Filters">
          <FilterSection title="Mode">
            <ModeChip value="all" current={mode} onChange={setMode}>Any mode</ModeChip>
            <ModeChip value="online" current={mode} onChange={setMode}>Online</ModeChip>
            <ModeChip value="in_person" current={mode} onChange={setMode}>In-person</ModeChip>
            <ModeChip value="both" current={mode} onChange={setMode}>Either</ModeChip>
          </FilterSection>

          <FilterSection title="Activity category">
            <ToggleChip selected={category === null} onClick={() => setCategory(null)}>Any</ToggleChip>
            {activityCategories.map((value) => (
              <ToggleChip
                key={value}
                selected={category === value}
                onClick={() => setCategory(category === value ? null : value)}
              >
                {value}
              </ToggleChip>
            ))}
          </FilterSection>

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

          <FilterSection title="Availability">
            <label className="flex items-center gap-2 text-meta cursor-pointer">
              <input
                type="checkbox"
                checked={bookableOnly}
                onChange={(event) => setBookableOnly(event.currentTarget.checked)}
              />
              <span>Bookable now (hide demo profiles)</span>
            </label>
          </FilterSection>
        </aside>

        <section aria-label="Results">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">No matches with these filters.</p>
              <p className="text-meta">Loosen a filter or clear all to see every approved host.</p>
            </div>
          ) : (
            <div className="panel">
              <div className="worklist" role="list">
                {filtered.map((host) => (
                  <HostRow key={host._id} host={host} />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function HostRow({ host }: { host: DiscoveryHost }) {
  return (
    <article className="worklist-row" role="listitem">
      <div className="worklist-row-head">
        <div className="flex items-start gap-3 min-w-0">
          <span className="avatar avatar-lg" aria-hidden="true">{initials(host.displayName)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-h3">{host.displayName}</h2>
              <TrustChip state={host.demo ? 'demo' : host.bookable ? 'verified' : 'awaiting'} />
            </div>
            <div className="worklist-row-meta mt-1">
              <span>{host.city}</span>
              <span className="dot" aria-hidden="true" />
              <span>{formatMode(host.mode)}</span>
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
            <Link to="/app" search={{ hostProfileId: host._id }} className="btn btn-social btn-sm">
              Request booking
            </Link>
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
