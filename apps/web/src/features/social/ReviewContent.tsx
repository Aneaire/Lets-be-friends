import { OpenableImage } from '../../design-system/molecules/OpenableImage'
import { ReviewStars } from './ReviewStars'

export function ReviewContent({
  rating,
  body,
  imageUrl,
  imageUrls,
  reviewerDisplayName,
  showRatingValue = false,
  bodyClassName = 'social-review-body',
  imageWrapperClassName,
  plainImage = false,
  onOpenImage,
}: {
  rating: number
  body?: string | null
  imageUrl?: string | null
  imageUrls?: readonly string[]
  reviewerDisplayName: string
  showRatingValue?: boolean
  bodyClassName?: string
  imageWrapperClassName?: string
  // Renders the feed's image sizing without a viewer, for surfaces that only
  // show how a review will look.
  plainImage?: boolean
  onOpenImage?: (index: number) => void
}) {
  const images = (imageUrls?.length ? imageUrls : imageUrl ? [imageUrl] : []).filter(Boolean)

  const photo = (src: string, index: number) => (
    onOpenImage ? (
      <button
        key={src}
        type="button"
        className="social-review-image-open"
        onClick={() => onOpenImage(index)}
        aria-label={images.length > 1
          ? `Open photo ${index + 1} of ${images.length} with description and comments`
          : `Open ${reviewerDisplayName}'s review photo with description and comments`}
      >
        <img src={src} alt={`Photo shared with ${reviewerDisplayName}'s review`} loading="lazy" />
      </button>
    ) : plainImage ? (
      <img
        key={src}
        className="social-review-image-plain"
        src={src}
        alt={`Photo shared with ${reviewerDisplayName}'s review`}
        loading="lazy"
      />
    ) : (
      <OpenableImage key={src} src={src} alt={`Photo shared with ${reviewerDisplayName}'s review`} />
    )
  )

  const image = images.length === 0
    ? null
    : images.length === 1
      ? photo(images[0], 0)
      : (
        <div className="social-review-image-grid" data-count={Math.min(images.length, 4)}>
          {images.map(photo)}
        </div>
      )

  return (
    <>
      <ReviewStars rating={rating} showValue={showRatingValue} />
      {body ? <p className={bodyClassName}>{body}</p> : null}
      {image ? (imageWrapperClassName ? <div className={imageWrapperClassName}>{image}</div> : image) : null}
    </>
  )
}
