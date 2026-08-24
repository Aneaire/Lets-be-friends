import { useRef, type KeyboardEvent } from 'react'

export type SegmentedControlOption<T extends string> = {
  value: T
  label: string
  disabled?: boolean
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = 'neutral',
  className = '',
}: {
  label: string
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  tone?: 'neutral' | 'self' | 'social'
  className?: string
}) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedEnabled = options.some((option) => option.value === value && !option.disabled)
  const fallbackIndex = options.findIndex((option) => !option.disabled)

  function moveSelection(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    const enabled = options
      .map((option, index) => ({ option, index }))
      .filter(({ option }) => !option.disabled)
    if (!enabled.length) return

    const currentIndex = enabled.findIndex(({ option }) => option.value === value)
    let nextIndex = currentIndex < 0 ? 0 : currentIndex
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (Math.max(currentIndex, -1) + 1) % enabled.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex <= 0 ? enabled.length : currentIndex) - 1
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = enabled.length - 1

    event.preventDefault()
    const next = enabled[nextIndex]
    if (!next) return
    onChange(next.option.value)
    itemRefs.current[next.index]?.focus()
  }

  return (
    <div
      className={`ds-segmented-control ${className}`.trim()}
      role="radiogroup"
      aria-label={label}
      data-tone={tone}
      onKeyDown={moveSelection}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(element) => { itemRefs.current[index] = element }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={(selected && !option.disabled) || (!selectedEnabled && index === fallbackIndex) ? 0 : -1}
            disabled={option.disabled}
            data-active={selected || undefined}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
