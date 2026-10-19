import { Star } from 'lucide-react'

const RATINGS = [1, 2, 3, 4, 5] as const

const ratingWords: Record<number, string> = {
  1: 'Not for me',
  2: 'Below expectations',
  3: 'Good',
  4: 'Great',
  5: 'Outstanding',
}

/**
 * The rating control for the review composer. Each star is a radio so the
 * keyboard and screen readers get the same five choices the pointer does.
 */
export function ReviewStarPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number | undefined
  onChange: (rating: number) => void
  disabled?: boolean
}) {
  return (
    <div className="review-star-picker">
      <div className="review-star-picker-row" role="radiogroup" aria-label="Rating">
        {RATINGS.map((rating) => {
          const filled = (value ?? 0) >= rating
          return (
            <button
              key={rating}
              type="button"
              role="radio"
              aria-checked={value === rating}
              aria-label={`${rating} ${rating === 1 ? 'star' : 'stars'}`}
              className="review-star-picker-star"
              data-filled={filled ? 'true' : undefined}
              disabled={disabled}
              onClick={() => onChange(rating)}
            >
              <Star size={28} fill={filled ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
          )
        })}
      </div>
      <p className="review-star-picker-value" aria-live="polite">
        {value ? `${value} of 5, ${ratingWords[value]}` : 'Pick a rating'}
      </p>
    </div>
  )
}
