// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PostMediaGrid } from '../../src/features/social/PostMediaGrid'
import { ReviewContent } from '../../src/features/social/ReviewContent'
import { SocialLightbox } from '../../src/features/social/SocialLightbox'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.style.overflow = ''
})

function stubImmediateAnimationFrame() {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
}

describe('SocialLightbox', () => {
  it('takes over the page with media, description, and comments', () => {
    stubImmediateAnimationFrame()
    render(
      <SocialLightbox
        open
        onClose={() => undefined}
        title="Post by Mara"
        media={[
          { kind: 'image', url: '/photo-1.jpg', alt: 'Image 1 shared in this post' },
          { kind: 'image', url: '/photo-2.jpg', alt: 'Image 2 shared in this post' },
        ]}
        initialIndex={0}
        details={(
          <div>
            <p>A quiet creative session can be social too.</p>
            <p>This sounds like a thoughtful plan.</p>
          </div>
        )}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Post by Mara' })
    expect(dialog.classList.contains('social-lightbox')).toBe(true)
    expect(screen.getByAltText('Image 1 shared in this post').getAttribute('src')).toBe('/photo-1.jpg')
    expect(screen.getByText('A quiet creative session can be social too.')).toBeTruthy()
    expect(screen.getByText('This sounds like a thoughtful plan.')).toBeTruthy()
    expect(screen.getByText('1 of 2')).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('moves between media with buttons and arrow keys, then closes with Escape', () => {
    stubImmediateAnimationFrame()
    const onClose = vi.fn()
    render(
      <SocialLightbox
        open
        onClose={onClose}
        title="Post by Mara"
        media={[
          { kind: 'image', url: '/photo-1.jpg', alt: 'Image 1 shared in this post' },
          { kind: 'image', url: '/photo-2.jpg', alt: 'Image 2 shared in this post' },
        ]}
        details={<p>Description</p>}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show next media' }))
    expect(screen.getByAltText('Image 2 shared in this post')).toBeTruthy()
    expect(screen.getByText('2 of 2')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(screen.getByAltText('Image 1 shared in this post')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('opens the fullscreen viewer from a feed post image instead of the compact viewer', () => {
    stubImmediateAnimationFrame()
    const onOpenAt = vi.fn()
    render(
      <PostMediaGrid
        media={[{ storageId: 'photo-1', kind: 'image', url: '/photo.webp' }]}
        onOpenAt={onOpenAt}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open post image 1 with description and comments' }))
    expect(onOpenAt).toHaveBeenCalledWith(0)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the fullscreen viewer from a review photo with description and comments context', () => {
    stubImmediateAnimationFrame()
    const onOpenImage = vi.fn()
    render(
      <ReviewContent
        rating={5}
        body="The photo walk was comfortable."
        imageUrl="/review.jpg"
        reviewerDisplayName="Angelo Santiago"
        onOpenImage={onOpenImage}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: "Open Angelo Santiago's review photo with description and comments" }))
    expect(onOpenImage).toHaveBeenCalledOnce()
  })
})
