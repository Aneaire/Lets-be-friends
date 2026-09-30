// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatVideoTime, SocialVideoPlayer } from '../../src/features/social/SocialVideoPlayer'

afterEach(cleanup)

function renderPlayer(props?: Partial<React.ComponentProps<typeof SocialVideoPlayer>>) {
  const onExpand = vi.fn()
  const utils = render(
    <SocialVideoPlayer
      src="/clip.mp4"
      label="Video 1 shared in this post"
      onExpand={onExpand}
      {...props}
    />,
  )
  const video = utils.container.querySelector('video')!
  const play = vi.fn().mockResolvedValue(undefined)
  const pause = vi.fn()
  Object.defineProperties(video, {
    play: { configurable: true, value: play },
    pause: { configurable: true, value: pause },
    duration: { configurable: true, value: 76 },
    currentTime: { configurable: true, writable: true, value: 6 },
  })
  return { ...utils, video, play, pause, onExpand }
}

describe('formatVideoTime', () => {
  it('formats seconds, minutes, and hours without em dashes or extra parts', () => {
    expect(formatVideoTime(0)).toBe('0:00')
    expect(formatVideoTime(8)).toBe('0:08')
    expect(formatVideoTime(76)).toBe('1:16')
    expect(formatVideoTime(3723)).toBe('1:02:03')
    expect(formatVideoTime(Number.NaN)).toBe('0:00')
  })
})

describe('SocialVideoPlayer', () => {
  it('renders a minimal bar with play, progress, and top-left mute only', () => {
    const { container } = renderPlayer()
    const video = container.querySelector('video')!

    fireEvent.loadedMetadata(video)
    fireEvent.timeUpdate(video)

    expect(screen.getAllByRole('button', { name: 'Play Video 1 shared in this post' })).toHaveLength(2)
    expect(screen.getByRole('slider', { name: 'Seek Video 1 shared in this post' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open Video 1 shared in this post' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Unmute video' }).classList.contains('social-video-mute-float')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Go back 10 seconds' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Go forward 10 seconds' })).toBeNull()
    expect(screen.queryByRole('slider', { name: 'Video volume' })).toBeNull()
    expect(container.querySelector('.social-video-time')).toBeNull()
    expect(container.querySelector('.social-video-scrub')).toBeTruthy()
  })

  it('toggles playback when the video surface is clicked', () => {
    const { video, play, pause } = renderPlayer()

    Object.defineProperty(video, 'paused', { configurable: true, value: true })
    fireEvent.click(video)
    expect(play).toHaveBeenCalledOnce()

    Object.defineProperty(video, 'paused', { configurable: true, value: false })
    fireEvent.play(video)
    expect(screen.getByRole('button', { name: 'Pause Video 1 shared in this post' })).toBeTruthy()

    fireEvent.click(video)
    expect(pause).toHaveBeenCalledOnce()
  })

  it('opens the viewer instead of toggling playback when a surface handler is provided', () => {
    const onSurfaceClick = vi.fn()
    const { video, play } = renderPlayer({ onSurfaceClick })

    Object.defineProperty(video, 'paused', { configurable: true, value: true })
    fireEvent.click(video)
    expect(onSurfaceClick).toHaveBeenCalledOnce()
    expect(play).not.toHaveBeenCalled()
  })

  it('seeks through the bottom progress bar', () => {
    const { container, video } = renderPlayer()
    const seek = screen.getByRole('slider', { name: 'Seek Video 1 shared in this post' }) as HTMLInputElement

    fireEvent.loadedMetadata(video)
    expect(seek.max).toBe('76')
    expect(container.querySelector('.social-video-scrub-track')).toBeTruthy()

    fireEvent.change(seek, { target: { value: '30' } })
    expect(video.currentTime).toBe(30)
  })

  it('paints the progress bar on animation frames while playing', () => {
    let frameCallback: FrameRequestCallback = () => undefined
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameCallback = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    try {
      const { container, video } = renderPlayer()
      fireEvent.loadedMetadata(video)
      Object.defineProperty(video, 'currentTime', { configurable: true, value: 19 })
      fireEvent.play(video)
      frameCallback(0)
      expect(container.querySelector<HTMLElement>('.social-video-scrub-fill')?.style.width).toBe('25%')
      expect(container.querySelector<HTMLElement>('.social-video-scrub-thumb')?.style.left).toBe('25%')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('fills the progress bar and moves the thumb with playback', () => {
    const { container, video } = renderPlayer()

    fireEvent.loadedMetadata(video)
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 38 })
    fireEvent.timeUpdate(video)

    expect(container.querySelector<HTMLElement>('.social-video-scrub-fill')?.style.width).toBe('50%')
    expect(container.querySelector<HTMLElement>('.social-video-scrub-thumb')?.style.left).toBe('50%')
  })

  it('toggles sound from the top-left mute button', () => {
    const { video } = renderPlayer()

    fireEvent.click(screen.getByRole('button', { name: 'Unmute video' }))
    expect(screen.getByRole('button', { name: 'Mute video' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Mute video' }))
    expect(screen.getByRole('button', { name: 'Unmute video' })).toBeTruthy()
    expect(video.muted).toBe(true)
  })

  it('opens the expanded viewer from the control bar', () => {
    const { onExpand } = renderPlayer()

    fireEvent.click(screen.getByRole('button', { name: 'Open Video 1 shared in this post' }))
    expect(onExpand).toHaveBeenCalledOnce()
  })

  it('omits the expand control when no expand handler is provided', () => {
    render(
      <SocialVideoPlayer
        src="/clip.mp4"
        label="Video 1 shared in this post"
      />,
    )

    expect(screen.queryByRole('button', { name: 'Open Video 1 shared in this post' })).toBeNull()
    expect(screen.getByRole('slider', { name: 'Seek Video 1 shared in this post' })).toBeTruthy()
  })
})
