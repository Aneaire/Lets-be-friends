import { allActivityCategoryLabel } from '@lets-be-friends/shared'
import { Check } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../design-system/atoms/Button'
import { Dialog } from '../../design-system/molecules/Dialog'
import { SearchField } from '../../design-system/molecules/SearchField'

export function CategoryFilterDialog({
  open,
  categories,
  selectedCategory,
  resultCount,
  onChange,
  onClose,
}: {
  open: boolean
  categories: readonly string[]
  selectedCategory: string | null
  resultCount: number
  onChange: (category: string | null) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const matchingCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return categories
    return categories.filter((category) => category.toLocaleLowerCase().includes(normalizedQuery))
  }, [categories, query])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="What would you like to do?"
      description="Choose one category or search the full list."
      closeLabel="Close categories"
      initialFocusRef={searchRef}
      className="category-filter-dialog"
      bodyClassName="category-filter-dialog-body"
      footer={(
        <>
          <Button intent="ghost" size="small" disabled={selectedCategory === null} onClick={() => onChange(null)}>
            Clear
          </Button>
          <Button intent="social" size="small" onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? 'result' : 'results'}
          </Button>
        </>
      )}
    >
      <div className="category-filter-search">
        <SearchField
          ref={searchRef}
          label="Search categories"
          value={query}
          onChange={setQuery}
          placeholder="Search categories"
          clearLabel="Clear category search"
          autoComplete="off"
        />
        <p className="text-meta tabular" aria-live="polite">
          {matchingCategories.length} {matchingCategories.length === 1 ? 'category' : 'categories'}
        </p>
      </div>

      {!query.trim() && (
        <CategoryOption
          value={allActivityCategoryLabel}
          selected={selectedCategory === null}
          onClick={() => onChange(null)}
          className="category-option-all"
        />
      )}

      {matchingCategories.length > 0 ? (
        <div className="category-option-grid" role="group" aria-label="Activity categories">
          {matchingCategories.map((category) => (
            <CategoryOption
              key={category}
              value={category}
              selected={selectedCategory === category}
              onClick={() => onChange(selectedCategory === category ? null : category)}
            />
          ))}
        </div>
      ) : (
        <div className="category-filter-empty" role="status">
          <p>No categories match that search.</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuery('')}>Reset search</button>
        </div>
      )}
    </Dialog>
  )
}

function CategoryOption({
  value,
  selected,
  onClick,
  className = '',
}: {
  value: string
  selected: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={`category-option ${className}`.trim()}
      data-selected={selected}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span>{value}</span>
      {selected ? <Check size={16} strokeWidth={2.25} aria-hidden="true" /> : null}
    </button>
  )
}
