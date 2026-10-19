import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ReviewComposerDialog } from '../social/ReviewComposerDialog'

/**
 * The booking surfaces only offer the entry point. Writing happens in the
 * composer dialog, which owns the rating, the note, the photos, and the live
 * card of how the published review will read.
 */
export function ReviewForm({
  onReview,
  preview,
}: {
  onReview: (rating: number, body: string | undefined, imageUploadIds: Id<'reviewMediaUploads'>[]) => Promise<void>
  // Present only where the review can reach the feed, which is where the
  // composer shows the live card and names the Companion.
  preview?: { companionName: string }
}) {
  const [open, setOpen] = useState(false)
  const viewer = useQuery(api.users.viewer)

  return (
    <>
      <button type="button" className="btn btn-social-quiet btn-sm" onClick={() => setOpen(true)}>
        Leave a review
      </button>
      <ReviewComposerDialog
        open={open}
        onClose={() => setOpen(false)}
        authorName={viewer?.displayName ?? 'You'}
        authorImageUrl={viewer?.profileImageUrl}
        companionName={preview?.companionName}
        onSubmit={onReview}
      />
    </>
  )
}
