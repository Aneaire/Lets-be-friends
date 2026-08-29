export type PostImagePressContext = 'feed' | 'comments'

export function postImagePressLabel(context: PostImagePressContext, index: number, total: number) {
  const position = `image ${index + 1} of ${total}`
  return context === 'feed'
    ? `Open post and comments for ${position}`
    : `View post ${position} full screen`
}
