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
    expect(video?.getAttribute('role')).toBeNull()
    expect(video?.getAttribute('tabindex')).toBeNull()
    const openButton = screen.getByRole('button', { name: 'Open Video 2 shared in this post' })
    expect(openButton.classList.contains('social-post-video-open')).toBe(true)
    expect(openButton.hasAttribute('style')).toBe(false)
    expect(screen.getByRole('button', { name: 'Unmute video' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Play Video 2 shared in this post' })).toHaveLength(1)
    expect(screen.getByRole('slider', { name: 'Seek Video 2 shared in this post' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Go back 10 seconds' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Go forward 10 seconds' })).toBeNull()
    expect(screen.queryByRole('slider', { name: 'Video volume' })).toBeNull()
    expect(container.querySelector('.social-video-scrub')).toBeTruthy()
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
    const seek = screen.getByRole('slider', { name: 'Seek Video 1 shared in this post' }) as HTMLInputElement
    expect(seek.max).toBe('76')
    expect(seek.value).toBe('6')

    fireEvent.click(screen.getByRole('button', { name: 'Unmute video' }))
    expect(screen.getByRole('button', { name: 'Mute video' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Open Video 1 shared in this post' }))
    expect(video.pause).toHaveBeenCalledOnce()
    expect(screen.getByRole('dialog', { name: 'Video 1 shared in this post' })).toBeTruthy()
    expect(screen.getByLabelText('Video 1 shared in this post, expanded')).toBeTruthy()
  })

  it('opens the expanded viewer when the video surface is clicked on the feed', () => {
    render(
      <PostMediaGrid media={[{ storageId: 'video-1', kind: 'video', url: '/clip.mp4' }]} />,
    )

    fireEvent.click(screen.getByLabelText('Video 1 shared in this post'))
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
    expect(observe).toHaveBeenCalledWith(container.querySelector('.social-video-player'))

    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('contains a rejected autoplay promise when a video scrolls into view', () => {
    let reportIntersection: IntersectionObserverCallback = () => undefined
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        reportIntersection = callback
      }
      observe = vi.fn()
      disconnect = vi.fn()
    })

    const { container } = render(
      <PostMediaGrid media={[{ storageId: 'video-1', kind: 'video', url: '/clip.mp4' }]} />,
    )
    const video = container.querySelector('video')!
    const rejectedPlayback = Promise.reject(new DOMException('The play() request was interrupted.', 'AbortError'))
    void rejectedPlayback.catch(() => undefined)
    const catchSpy = vi.spyOn(rejectedPlayback, 'catch')
    const play = vi.fn().mockReturnValue(rejectedPlayback)
    const pause = vi.fn()
    Object.defineProperties(video, {
      play: { configurable: true, value: play },
      pause: { configurable: true, value: pause },
    })

    reportIntersection([{ isIntersecting: true, intersectionRatio: 0.6 } as IntersectionObserverEntry], {} as IntersectionObserver)

    expect(play).toHaveBeenCalledOnce()
    expect(catchSpy).toHaveBeenCalledOnce()

    reportIntersection([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(pause).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('restores the expanded video position inline on close', () => {
    const { container } = render(
      <PostMediaGrid media={[{ storageId: 'video-1', kind: 'video', url: '/clip.mp4' }]} />,
    )
    const inlineVideo = container.querySelector('video')!
    const pause = vi.fn()
    Object.defineProperties(inlineVideo, {
      pause: { configurable: true, value: pause },
      currentTime: { configurable: true, writable: true, value: 4 },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open Video 1 shared in this post' }))
    expect(pause).toHaveBeenCalledOnce()

    const dialogVideo = screen.getByLabelText('Video 1 shared in this post, expanded')
    Object.defineProperty(dialogVideo, 'currentTime', { configurable: true, value: 9 })
    fireEvent.timeUpdate(dialogVideo)

    fireEvent.click(screen.getByRole('button', { name: 'Close video' }))

    expect(inlineVideo.currentTime).toBe(9)
    expect(screen.queryByRole('dialog')).toBeNull()
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
