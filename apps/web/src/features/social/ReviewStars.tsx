import { Star } from 'lucide-react'

export function ReviewStars({
  rating,
  showValue = false,
  label,
}: {
  rating: number
  showValue?: boolean
  label?: string
}) {
  return (
    <div className="profile-review-stars" role="img" aria-label={label ?? `${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, rating - index))
        return (
          <span key={index} className="profile-review-star" aria-hidden="true">
            <Star size={18} />
            <span style={{ width: `${fill * 100}%` }}><Star size={18} fill="currentColor" /></span>
          </span>
        )
      })}
      {showValue ? <strong aria-hidden="true">{rating.toFixed(1)}</strong> : null}
    </div>
  )
}
