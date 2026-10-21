import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'

/**
 * The submitted state replaces the review entry point. It stays a button so
 * the reviewer can open the review they published in a focused permalink.
 */
export function ReviewSubmittedLink({ reviewId }: { reviewId?: string }) {
  if (!reviewId) return <span className="text-meta">Review submitted</span>

  return (
    <Link
      to="/review"
      search={{ reviewId }}
      className="btn btn-neutral btn-sm"
    >
      <Check size={15} aria-hidden="true" />
      View your review
    </Link>
  )
}
