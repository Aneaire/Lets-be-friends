import { Check, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  activityCategoryOptions,
  maximumActivityCategoryLength,
  validateActivityCategories,
} from '@lets-be-friends/shared'

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
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(categoryPageSize)
  const [customValue, setCustomValue] = useState('')
  const [customError, setCustomError] = useState('')
  const allValues = useMemo(() => activityCategoryOptions(values, selected), [values, selected])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const availableValues = allValues.filter((value) => !selected.includes(value))
  const matchingValues = normalizedQuery
    ? availableValues.filter((value) => value.toLocaleLowerCase().includes(normalizedQuery))
    : availableValues
  const displayedValues = normalizedQuery ? matchingValues : matchingValues.slice(0, visibleCount)
  const hasMore = !normalizedQuery && visibleCount < matchingValues.length
  const canShowLess = !normalizedQuery && visibleCount > categoryPageSize

  const toggle = (value: string) => {
    setCustomError('')
    setSelected(selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value])
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

  return (
    <fieldset className="companion-chip-group category-picker">
      <legend className="sr-only">Activities</legend>
      <div className="companion-chip-heading category-picker-heading">
        <span>Activities</span>
        <span className="text-meta tabular">{selected.length} of {maximum} selected</span>
      </div>

      {selected.length > 0 && (
        <div className="category-picker-selected" aria-label="Selected activities">
          {selected.map((value) => (
            <button key={value} type="button" className="chip" data-selected="true" aria-pressed="true" onClick={() => toggle(value)}>
              <Check size={14} aria-hidden="true" />
              {value}
            </button>
          ))}
        </div>
      )}

      <label className="category-picker-search">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search activities</span>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value)
            setVisibleCount(categoryPageSize)
          }}
          placeholder="Search activities"
        />
        {query && <span className="text-meta tabular">{matchingValues.length} found</span>}
      </label>

      {displayedValues.length > 0 ? (
        <div className="category-picker-options" aria-label="Available activities">
          {displayedValues.map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed="false"
              disabled={selected.length >= maximum}
              onClick={() => toggle(value)}
            >
              {value}
            </button>
          ))}
        </div>
      ) : (
        <div className="category-picker-empty">
          <strong>No matching activities</strong>
          <span>Try another search or add your own category below.</span>
        </div>
      )}

      {(hasMore || canShowLess) && (
        <div className="category-picker-more">
          {hasMore && (
            <button type="button" className="btn btn-neutral btn-sm" onClick={() => setVisibleCount((count) => count + categoryPageSize)}>
              Show more <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}
          {canShowLess && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVisibleCount(categoryPageSize)}>
              Show less <ChevronUp size={16} aria-hidden="true" />
            </button>
          )}
          <span className="text-meta tabular">Showing {displayedValues.length} of {matchingValues.length}</span>
        </div>
      )}

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
        <button type="button" className="btn btn-self btn-sm" disabled={selected.length >= maximum} onClick={addCustomValue}>
          Add category
        </button>
      </div>
      {customError && <p className="field-row-help category-custom-error" role="alert">{customError}</p>}
      {selected.length >= maximum && <p className="field-row-help">You have selected the maximum of {maximum} activities. Remove one to choose another.</p>}
    </fieldset>
  )
}
