import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, type RefObject } from 'react'

import { findCompanions } from '../../lib/discoverySearch'
import type { ApprovedCompanionOption } from './BookingDialog'
import { BookingDialogCompanionAvatar } from './BookingDialogFrame'

export function BookingCompanionSearch({
  companions,
  loading,
  disabled = false,
  query,
  onQueryChange,
  selectedCompanionProfileId,
  onSelect,
  open,
  onOpenChange,
  searchRef,
}: {
  companions: ApprovedCompanionOption[]
  loading: boolean
  disabled?: boolean
  query: string
  onQueryChange: (query: string) => void
  selectedCompanionProfileId: string
  onSelect: (companion: ApprovedCompanionOption) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  searchRef?: RefObject<HTMLInputElement | null>
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const suppressNextFocusRef = useRef(false)
  const results = useMemo(() => {
    if (!query.trim()) return []
    return findCompanions(companions.map((companion) => ({
      ...companion,
      intro: companion.intro ?? '',
    })), query).slice(0, 6)
  }, [companions, query])
  const selectedCompanion = companions.find((companion) => companion._id === selectedCompanionProfileId)
  const showPanel = open && query.trim().length > 0

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [onOpenChange, open])

  function openWhenSearching() {
    if (suppressNextFocusRef.current) {
      suppressNextFocusRef.current = false
      return
    }
    if (query.trim() && query !== selectedCompanion?.displayName) onOpenChange(true)
  }

  return (
    <div className="field-row booking-companion-search-root" ref={rootRef}>
      <label className="label" htmlFor="booking-companion-search">Companion</label>
      <div className="booking-companion-search" role="search">
        <Search size={18} aria-hidden="true" />
        <input
          ref={searchRef}
          id="booking-companion-search"
          type="search"
          role="combobox"
          value={query}
          placeholder="Search by name, username, Strength, or city"
          aria-label="Search Companions"
          aria-expanded={showPanel}
          aria-haspopup="listbox"
          aria-controls="booking-companion-search-results"
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          required
          onFocus={openWhenSearching}
          onClick={openWhenSearching}
          onChange={(event) => {
            const nextQuery = event.currentTarget.value
            suppressNextFocusRef.current = false
            onQueryChange(nextQuery)
            onOpenChange(nextQuery.trim().length > 0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && results.length > 0) {
              event.preventDefault()
              rootRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus()
            }
          }}
        />
        {query && (
          <button
            type="button"
            className="booking-companion-search-clear"
            aria-label="Clear Companion search"
            data-tooltip="Clear Companion search"
            data-tooltip-position="below-right"
            disabled={disabled}
            onClick={() => {
              onQueryChange('')
              onOpenChange(false)
              searchRef?.current?.focus()
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      {showPanel && (
        <div id="booking-companion-search-results" className="booking-companion-search-panel">
          {loading ? (
            <p className="booking-companion-search-guidance" role="status">Searching…</p>
          ) : results.length === 0 ? (
            <p className="booking-companion-search-guidance" role="status">No Companions match “{query.trim()}”.</p>
          ) : (
            <>
              <p className="booking-companion-search-summary" role="status">
                {results.length} {results.length === 1 ? 'match' : 'matches'}
              </p>
              <ul className="booking-companion-search-list" role="listbox" aria-label="Companion search results">
                {results.map((companion) => (
                  <li key={companion._id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={companion._id === selectedCompanionProfileId}
                      className="booking-companion-search-result"
                      onClick={() => {
                        suppressNextFocusRef.current = true
                        onSelect(companion)
                        searchRef?.current?.focus()
                      }}
                    >
                      <BookingDialogCompanionAvatar profileImageUrl={companion.profileImageUrl} />
                      <span>
                        <strong>{companion.displayName}</strong>
                        <small>{[companion.username ? `@${companion.username}` : undefined, companion.city, companion.strengths?.[0] ?? companion.categories?.[0]].filter(Boolean).join(' · ')}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
