export type PostImagePressContext = 'feed' | 'comments'

export const postMediaCompactAspect = 4 / 3
export const postMediaSingleFallbackAspect = 4 / 3

export function postImagePressLabel(context: PostImagePressContext, index: number, total: number) {
  const position = `image ${index + 1} of ${total}`
  return context === 'feed'
    ? `Open post and comments for ${position}`
    : `View post ${position} full screen`
}

export function postMediaAspectRatio(width: number, height: number, single: boolean) {
  if (!single) return postMediaCompactAspect
  if (width > 0 && height > 0) return width / height
  return postMediaSingleFallbackAspect
}

export function postMediaLayout(width: number, height: number): 'portrait' | 'landscape' | 'unknown' {
  if (width <= 0 || height <= 0) return 'unknown'
  if (width < height) return 'portrait'
  if (width > height) return 'landscape'
  return 'landscape'
}
