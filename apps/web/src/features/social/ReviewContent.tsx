import { OpenableImage } from '../../design-system/molecules/OpenableImage'
import { ReviewStars } from './ReviewStars'

export function ReviewContent({
  rating,
  body,
  imageUrl,
  reviewerDisplayName,
  showRatingValue = false,
  bodyClassName = 'social-review-body',
  imageWrapperClassName,
}: {
  rating: number
  body?: string | null
  imageUrl?: string | null
  reviewerDisplayName: string
  showRatingValue?: boolean
  bodyClassName?: string
  imageWrapperClassName?: string
}) {
  const image = imageUrl ? (
    <OpenableImage src={imageUrl} alt={`Photo shared with ${reviewerDisplayName}'s review`} />
  ) : null

  return (
    <>
      <ReviewStars rating={rating} showValue={showRatingValue} />
      {body ? <p className={bodyClassName}>{body}</p> : null}
      {image ? (imageWrapperClassName ? <div className={imageWrapperClassName}>{image}</div> : image) : null}
    </>
  )
}
