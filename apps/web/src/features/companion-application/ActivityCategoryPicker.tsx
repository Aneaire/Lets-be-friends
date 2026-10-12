import { Check, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import {
  activityCategoryOptions,
  maximumActivityCategoryLength,
  validateActivityCategories,
} from '@lets-be-friends/shared'
import { Button } from '../../design-system/atoms/Button'
import { Dialog } from '../../design-system/molecules/Dialog'
import { SearchField } from '../../design-system/molecules/SearchField'

const categoryPageSize = 12

export function ActivityCategoryPicker({
  values,
  selected,
  setSelected,
  maximum,
}: {
  values: readonly string[]
  selected: string[]
  setSelected: (next: string[]) => void
  maximum: number
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(categoryPageSize)
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const [customValue, setCustomValue] = useState('')
  const [customError, setCustomError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const allValues = useMemo(() => activityCategoryOptions(values, selected), [values, selected])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matchingValues = useMemo(() => normalizedQuery
    ? allValues.filter((value) => value.toLocaleLowerCase().includes(normalizedQuery))
    : allValues, [allValues, normalizedQuery])
  const displayedValues = matchingValues.slice(0, visibleCount)
  const hasMore = displayedValues.length < matchingValues.length

  useEffect(() => {
    if (!open) return
    setQuery('')
    setVisibleCount(categoryPageSize)
    if (scrollRoot) scrollRoot.scrollTop = 0
  }, [open, scrollRoot])

  const loadNextPage = useCallback(() => {
    setVisibleCount((count) => Math.min(count + categoryPageSize, matchingValues.length))
  }, [matchingValues.length])

  // Drive pagination from inView (not only onChange entries) so paging re-arms
  // while the sentinel stays visible: short filtered lists, tall containers,
  // and query changes that reset the batch while the footer is on screen.
  // Loading is bounded by matchingValues.length, so the loop always terminates.
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
    root: scrollRoot,
    rootMargin: '0px 0px 80px',
    skip: !open || !scrollRoot || !hasMore,
    triggerOnce: false,
  })

  useEffect(() => {
    if (open && hasMore && loadMoreInView) loadNextPage()
  }, [open, hasMore, loadMoreInView, loadNextPage, visibleCount, matchingValues.length])

  const toggle = (value: string) => {
    setCustomError('')
    if (selected.includes(value)) {
      setSelected(selected.filter((item) => item !== value))
      return
    }
    if (selected.length < maximum) setSelected([...selected, value])
  }

  const addCustomValue = () => {
    const result = validateActivityCategories([...selected, customValue], maximum)
    if (!result.ok) {
      setCustomError(result.message)
      return
    }
    setSelected(result.value)
    setCustomValue('')
    setCustomError('')
  }

  const updateQuery = (value: string) => {
    setQuery(value)
    setVisibleCount(categoryPageSize)
    if (scrollRoot) scrollRoot.scrollTop = 0
  }

  return (
    <fieldset className="companion-chip-group category-picker">
      <legend className="sr-only">Activities</legend>
      <div className="companion-chip-heading category-picker-heading">
        <span>Activities</span>
        <span className="text-meta tabular">{selected.length} of {maximum} selected</span>
      </div>

      {selected.length > 0 ? (
        <div className="category-picker-selected" aria-label="Selected activities">
          {selected.map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              data-selected="true"
              aria-label={`Remove ${value}`}
              onClick={() => toggle(value)}
            >
              <span>{value}</span>
              <X size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <p className="category-picker-summary-empty">No activities selected yet.</p>
      )}

      <Button intent="self" onClick={() => setOpen(true)} leadingIcon={<Plus size={16} aria-hidden="true" />}>
        Browse categories
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Browse activity categories"
        description={`Choose up to ${maximum}. You can search the full list and remove selected activities at any time.`}
        closeLabel="Close category browser"
        initialFocusRef={searchRef}
        className="category-browser-dialog"
        bodyClassName="category-browser-dialog-body"
        footer={<Button intent="self" onClick={() => setOpen(false)}>Done</Button>}
      >
        <div className="category-browser-search">
          <SearchField
            ref={searchRef}
            label="Search activity categories"
            value={query}
            onChange={updateQuery}
            placeholder="Search categories"
            clearLabel="Clear category search"
            autoComplete="off"
          />
          <p className="text-meta tabular" aria-live="polite">
            {matchingValues.length} {matchingValues.length === 1 ? 'category' : 'categories'} found
          </p>
        </div>

        <div ref={setScrollRoot} className="category-browser-scroll" data-testid="category-browser-scroll">
          {displayedValues.length > 0 ? (
            <div className="category-browser-options" role="group" aria-label="Activity category choices">
              {displayedValues.map((value) => {
                const isSelected = selected.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    className="category-browser-option"
                    data-selected={isSelected}
                    aria-pressed={isSelected}
                    disabled={!isSelected && selected.length >= maximum}
                    onClick={() => toggle(value)}
                  >
                    <span>{value}</span>
                    {isSelected ? <Check size={16} strokeWidth={2.25} aria-hidden="true" /> : null}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="category-picker-empty" role="status">
              <strong>No matching activities</strong>
              <span>Try another search or add your own category after closing this window.</span>
              <Button intent="ghost" size="small" onClick={() => updateQuery('')}>Reset search</Button>
            </div>
          )}

          {hasMore ? (
            <div className="category-browser-more">
              <div ref={loadMoreRef} className="category-browser-sentinel" aria-hidden="true" />
              <Button intent="neutral" size="small" onClick={loadNextPage}>Load more categories</Button>
              <span className="text-meta tabular">Showing {displayedValues.length} of {matchingValues.length}</span>
            </div>
          ) : matchingValues.length > 0 ? (
            <p className="category-browser-count text-meta tabular">Showing all {matchingValues.length} categories</p>
          ) : null}
        </div>
      </Dialog>

      <div className="category-custom-entry mt-4">
        <label className="field-row">
          <span className="label">Can’t find it? Add your own</span>
          <input
            className="field"
            value={customValue}
            maxLength={maximumActivityCategoryLength}
            disabled={selected.length >= maximum}
            onChange={(event) => {
              setCustomValue(event.currentTarget.value)
              setCustomError('')
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              addCustomValue()
            }}
            placeholder="For example, museum visits"
          />
        </label>
        <Button intent="self" size="small" disabled={selected.length >= maximum} onClick={addCustomValue}>
          Add category
        </Button>
      </div>
      {customError && <p className="field-row-help category-custom-error" role="alert">{customError}</p>}
      {selected.length >= maximum && <p className="field-row-help">You have selected the maximum of {maximum} activities. Remove one to choose another.</p>}
    </fieldset>
  )
}
