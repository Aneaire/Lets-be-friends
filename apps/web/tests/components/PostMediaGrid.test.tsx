// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PostMediaGrid } from '../../src/features/social/PostMediaGrid'

afterEach(cleanup)

describe('PostMediaGrid', () => {
  it('preserves display image and video behavior', () => {
    const { container } = render(
      <PostMediaGrid
        className="profile-post-media"
        media={[
          { storageId: 'photo-1', kind: 'image', url: '/photo.webp' },
          { storageId: 'video-1', kind: 'video', url: '/clip.mp4' },
          { storageId: 'pending-1', kind: 'image', url: null },
        ]}
      />,
    )

    const grid = container.querySelector('.social-media-grid')
    const image = container.querySelector('img')
    const video = container.querySelector('video')

    expect(grid?.classList.contains('profile-post-media')).toBe(true)
    expect(grid?.getAttribute('data-count')).toBe('3')
    expect(grid?.children).toHaveLength(3)
    expect(image?.getAttribute('src')).toBe('/photo.webp')
    expect(image?.getAttribute('loading')).toBe('lazy')
    expect(screen.getByRole('button', { name: 'Open post image 1' })).toBe(image)
    expect(video?.getAttribute('src')).toBe('/clip.mp4')
    expect(video?.controls).toBe(false)
    expect(video?.autoplay).toBe(true)
    expect(video?.loop).toBe(true)
    expect(video?.muted).toBe(true)
    expect(video?.playsInline).toBe(true)
    expect(video?.preload).toBe('metadata')
    expect(screen.getByRole('button', { name: 'Unmute video' })).toBeTruthy()
    expect(container.querySelector('.social-post-video-time')).toBeNull()
  })

  it('updates video time, toggles sound, and opens the expanded video', () => {
    const { container } = render(
      <PostMediaGrid media={[{ storageId: 'video-1', kind: 'video', url: '/clip.mp4' }]} />,
    )
    const video = container.querySelector('video')!
    Object.defineProperties(video, {
      duration: { configurable: true, value: 76 },
      currentTime: { configurable: true, writable: true, value: 6 },
      pause: { configurable: true, value: vi.fn() },
    })

    fireEvent.loadedMetadata(video)
    fireEvent.timeUpdate(video)
    expect(container.querySelector<HTMLElement>('.social-post-video-progress')?.style.getPropertyValue('--video-progress')).toBe(`${(6 / 76) * 100}%`)

    fireEvent.click(screen.getByRole('button', { name: 'Unmute video' }))
    expect(screen.getByRole('button', { name: 'Mute video' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(video)
    expect(video.pause).toHaveBeenCalledOnce()
    expect(screen.getByRole('dialog', { name: 'Video 1 shared in this post' })).toBeTruthy()
    expect(screen.getByLabelText('Video 1 shared in this post, expanded')).toBeTruthy()
  })

  it('pauses outside the feed viewport and resumes after becoming visible', () => {
    let reportIntersection: IntersectionObserverCallback = () => undefined
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        reportIntersection = callback
      }
      observe = observe
      disconnect = disconnect
    })

    const { container, unmount } = render(
      <PostMediaGrid media={[{ storageId: 'video-1', kind: 'video', url: '/clip.mp4' }]} />,
    )
    const video = container.querySelector('video')!
    const play = vi.fn().mockResolvedValue(undefined)
    const pause = vi.fn()
    Object.defineProperties(video, {
      play: { configurable: true, value: play },
      pause: { configurable: true, value: pause },
    })

    reportIntersection([{ isIntersecting: true, intersectionRatio: 0.59 } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(pause).toHaveBeenCalledOnce()
    reportIntersection([{ isIntersecting: true, intersectionRatio: 0.6 } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(play).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledWith(container.querySelector('.social-post-video'))

    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('keeps display items keyed by storage id when their order changes', () => {
    const firstMedia = [
      { storageId: 'photo-1', kind: 'image' as const, url: '/one.webp' },
      { storageId: 'photo-2', kind: 'image' as const, url: '/two.webp' },
    ]
    const { container, rerender } = render(<PostMediaGrid media={firstMedia} />)
    const originalItems = Array.from(container.querySelectorAll('.social-media-item'))

    rerender(<PostMediaGrid media={[firstMedia[1], firstMedia[0]]} />)

    const reorderedItems = Array.from(container.querySelectorAll('.social-media-item'))
    expect(reorderedItems[0]).toBe(originalItems[1])
    expect(reorderedItems[1]).toBe(originalItems[0])
  })

  it('marks a single portrait image with its natural aspect ratio', () => {
    const { container } = render(
      <PostMediaGrid media={[{ storageId: 'portrait-1', kind: 'image', url: '/portrait.webp' }]} />,
    )
    const image = container.querySelector('img')

    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 720 },
      naturalHeight: { configurable: true, value: 1000 },
    })
    fireEvent.load(image!)

    const item = container.querySelector<HTMLElement>('.social-media-item')
    expect(item?.dataset.layout).toBe('portrait')
    expect(item?.style.getPropertyValue('--social-media-aspect')).toBe('0.72')
  })

  it('keeps a single landscape image on the default layout', () => {
    const { container } = render(
      <PostMediaGrid media={[{ storageId: 'landscape-1', kind: 'image', url: '/landscape.webp' }]} />,
    )
    const image = container.querySelector('img')

    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 1600 },
      naturalHeight: { configurable: true, value: 1000 },
    })
    fireEvent.load(image!)

    const item = container.querySelector<HTMLElement>('.social-media-item')
    expect(item?.dataset.layout).toBeUndefined()
    expect(item?.style.getPropertyValue('--social-media-aspect')).toBe('')
  })

  it('renders removable previews and reports the selected index', () => {
    const onRemove = vi.fn()
    const { container } = render(
      <PostMediaGrid
        mode="preview"
        media={[
          { previewUrl: 'blob:photo', kind: 'image' },
          { previewUrl: 'blob:video', kind: 'video' },
        ]}
        onRemove={onRemove}
      />,
    )

    const grid = container.querySelector('.social-media-preview-grid')
    const image = container.querySelector('img')
    const video = container.querySelector('video')

    expect(grid?.getAttribute('data-count')).toBe('2')
    expect(image?.getAttribute('src')).toBe('blob:photo')
    expect(image?.hasAttribute('loading')).toBe(false)
    expect(video?.getAttribute('src')).toBe('blob:video')
    expect(video?.muted).toBe(true)
    expect(video?.playsInline).toBe(true)
    expect(video?.controls).toBe(false)

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove media' })[1])
    expect(onRemove).toHaveBeenCalledOnce()
    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it('keeps preview items keyed by their object URLs', () => {
    const firstMedia = [
      { previewUrl: 'blob:one', kind: 'image' as const },
      { previewUrl: 'blob:two', kind: 'image' as const },
    ]
    const { container, rerender } = render(
      <PostMediaGrid mode="preview" media={firstMedia} onRemove={() => undefined} />,
    )
    const originalItems = Array.from(container.querySelectorAll('.social-media-preview'))

    rerender(
      <PostMediaGrid mode="preview" media={[firstMedia[1], firstMedia[0]]} onRemove={() => undefined} />,
    )

    const reorderedItems = Array.from(container.querySelectorAll('.social-media-preview'))
    expect(reorderedItems[0]).toBe(originalItems[1])
    expect(reorderedItems[1]).toBe(originalItems[0])
  })
})
