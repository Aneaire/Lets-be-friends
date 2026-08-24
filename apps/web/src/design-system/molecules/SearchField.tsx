import { LoaderCircle, Search, X } from 'lucide-react'
import { forwardRef, useId, type InputHTMLAttributes } from 'react'

export const SearchField = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  label: string
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  loading?: boolean
  clearLabel?: string
}>(function SearchField({
  label,
  value,
  onChange,
  onClear,
  loading = false,
  clearLabel = 'Clear search',
  className = '',
  id,
  ...props
}, ref) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={`ds-search-field ${className}`.trim()} data-loading={loading || undefined}>
      <Search size={17} aria-hidden="true" className="ds-search-field-icon" />
      <label className="sr-only" htmlFor={inputId}>{label}</label>
      <input
        {...props}
        ref={ref}
        id={inputId}
        type="search"
        value={value}
        aria-busy={loading || undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {loading ? (
        <LoaderCircle size={17} aria-hidden="true" className="ds-search-field-spinner" />
      ) : value && !props.disabled && !props.readOnly ? (
        <button
          type="button"
          className="ds-search-field-clear"
          aria-label={clearLabel}
          onClick={(event) => {
            const input = event.currentTarget.parentElement?.querySelector('input')
            onChange('')
            onClear?.()
            input?.focus()
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
})
