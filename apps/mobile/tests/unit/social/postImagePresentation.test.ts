import { postImagePressLabel } from '@/features/social/postImagePresentation'

describe('post image interactions', () => {
  it('describes the feed image as an entry to the post conversation', () => {
    expect(postImagePressLabel('feed', 0, 3)).toBe('Open post and comments for image 1 of 3')
  })

  it('describes the post image as an entry to the full-screen viewer', () => {
    expect(postImagePressLabel('comments', 1, 3)).toBe('View post image 2 of 3 full screen')
  })
})
