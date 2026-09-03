import {
  postImagePressLabel,
  postMediaAspectRatio,
  postMediaLayout,
} from '@/features/social/postImagePresentation'

describe('post image interactions', () => {
  it('describes the feed image as an entry to the post conversation', () => {
    expect(postImagePressLabel('feed', 0, 3)).toBe('Open post and comments for image 1 of 3')
  })

  it('describes the post image as an entry to the full-screen viewer', () => {
    expect(postImagePressLabel('comments', 1, 3)).toBe('View post image 2 of 3 full screen')
  })
})

describe('post media presentation', () => {
  it('preserves the natural aspect of a single image', () => {
    expect(postMediaAspectRatio(600, 800, true)).toBe(0.75)
    expect(postMediaAspectRatio(1200, 800, true)).toBe(1.5)
  })

  it('falls back to a 4:3 box before a single image size is known', () => {
    expect(postMediaAspectRatio(0, 0, true)).toBe(4 / 3)
  })

  it('keeps compact image tiles at a fixed 4:3 crop', () => {
    expect(postMediaAspectRatio(600, 800, false)).toBe(4 / 3)
    expect(postMediaAspectRatio(1200, 800, false)).toBe(4 / 3)
  })

  it('classifies image orientation for layout decisions', () => {
    expect(postMediaLayout(600, 800)).toBe('portrait')
    expect(postMediaLayout(1200, 800)).toBe('landscape')
    expect(postMediaLayout(0, 0)).toBe('unknown')
  })
})
