import {
  VIDEO_VIEWER_CLOSE_LABEL,
  VIDEO_VIEWER_DEFAULT_TITLE,
  VIDEO_VIEWER_ERROR_MESSAGE,
  VIDEO_VIEWER_RETRY_LABEL,
  VIDEO_VIEWER_UNAVAILABLE_MESSAGE,
  isPlayableVideoUrl,
  isVideoViewerOpen,
  nextVideoRetryToken,
  normalizeVideoUrl,
  pauseVideoPlayerBestEffort,
  resolveVideoViewerAccessibilityLabel,
  resolveVideoViewerTitle,
  shouldPauseVideoForAppState,
  shouldReplaceVideoSource,
} from '@/features/media/videoPresentation'

describe('video url safety', () => {
  it('accepts trimmed http and https urls', () => {
    expect(normalizeVideoUrl('  https://example.com/clip.mp4  ')).toBe('https://example.com/clip.mp4')
    expect(normalizeVideoUrl('HTTP://example.com/clip.mp4')).toBe('HTTP://example.com/clip.mp4')
  })

  it('rejects missing, empty, and non-remote urls', () => {
    expect(normalizeVideoUrl(null)).toBeNull()
    expect(normalizeVideoUrl(undefined)).toBeNull()
    expect(normalizeVideoUrl('   ')).toBeNull()
    expect(normalizeVideoUrl('blob:https://example.com/1')).toBeNull()
    expect(normalizeVideoUrl('data:video/mp4;base64,AAA')).toBeNull()
    expect(normalizeVideoUrl('ftp://example.com/clip.mp4')).toBeNull()
    expect(normalizeVideoUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeVideoUrl('/relative/clip.mp4')).toBeNull()
  })

  it('reports playability from the same safety rule', () => {
    expect(isPlayableVideoUrl('https://example.com/clip.mp4')).toBe(true)
    expect(isPlayableVideoUrl('data:video/mp4;base64,AAA')).toBe(false)
    expect(isPlayableVideoUrl(null)).toBe(false)
  })
})

describe('video viewer open state', () => {
  it('opens for any provided url and stays closed without one', () => {
    expect(isVideoViewerOpen('https://example.com/clip.mp4')).toBe(true)
    expect(isVideoViewerOpen('not-a-url-but-present')).toBe(true)
    expect(isVideoViewerOpen(null)).toBe(false)
    expect(isVideoViewerOpen(undefined)).toBe(false)
    expect(isVideoViewerOpen('   ')).toBe(false)
  })
})

describe('video viewer copy', () => {
  it('falls back to a default title and trims custom titles', () => {
    expect(resolveVideoViewerTitle(null)).toBe(VIDEO_VIEWER_DEFAULT_TITLE)
    expect(resolveVideoViewerTitle('   ')).toBe(VIDEO_VIEWER_DEFAULT_TITLE)
    expect(resolveVideoViewerTitle('  Weekend plans  ')).toBe('Weekend plans')
  })

  it('labels the player accessibly from the resolved title', () => {
    expect(resolveVideoViewerAccessibilityLabel('Weekend plans')).toBe('Weekend plans video player')
    expect(resolveVideoViewerAccessibilityLabel(null)).toBe(`${VIDEO_VIEWER_DEFAULT_TITLE} video player`)
  })

  it('keeps every user-facing string free of em dashes', () => {
    for (const copy of [
      VIDEO_VIEWER_DEFAULT_TITLE,
      VIDEO_VIEWER_CLOSE_LABEL,
      VIDEO_VIEWER_ERROR_MESSAGE,
      VIDEO_VIEWER_RETRY_LABEL,
      VIDEO_VIEWER_UNAVAILABLE_MESSAGE,
    ]) {
      expect(copy).not.toContain('\u2014')
    }
  })
})

describe('video viewer lifecycle decisions', () => {
  it('pauses playback whenever the app leaves the foreground', () => {
    expect(shouldPauseVideoForAppState('active')).toBe(false)
    expect(shouldPauseVideoForAppState('background')).toBe(true)
    expect(shouldPauseVideoForAppState('inactive')).toBe(true)
    expect(shouldPauseVideoForAppState('unknown')).toBe(true)
    expect(shouldPauseVideoForAppState('extension')).toBe(true)
  })

  it('advances the retry token so a failed video reloads', () => {
    expect(nextVideoRetryToken(0)).toBe(1)
    expect(nextVideoRetryToken(4)).toBe(5)
  })

  it('restarts retry counting from corrupted tokens', () => {
    expect(nextVideoRetryToken(Number.NaN)).toBe(1)
    expect(nextVideoRetryToken(-2)).toBe(1)
  })
})

describe('video source replacement', () => {
  it('does not replace the source on the initial mount', () => {
    const initial = { url: 'https://example.com/clip.mp4', retryToken: 0 }
    expect(shouldReplaceVideoSource(initial, { ...initial })).toBe(false)
  })

  it('replaces the source when the open video changes', () => {
    expect(shouldReplaceVideoSource(
      { url: 'https://example.com/first.mp4', retryToken: 0 },
      { url: 'https://example.com/second.mp4', retryToken: 0 },
    )).toBe(true)
  })

  it('replaces the source when retry advances, even for the same url', () => {
    expect(shouldReplaceVideoSource(
      { url: 'https://example.com/clip.mp4', retryToken: 0 },
      { url: 'https://example.com/clip.mp4', retryToken: 1 },
    )).toBe(true)
  })

  it('never replaces while the next source is missing', () => {
    expect(shouldReplaceVideoSource(
      { url: 'https://example.com/clip.mp4', retryToken: 0 },
      { url: null, retryToken: 1 },
    )).toBe(false)
    expect(shouldReplaceVideoSource(
      { url: null, retryToken: 0 },
      { url: null, retryToken: 0 },
    )).toBe(false)
  })
})

describe('best effort video pause', () => {
  it('pauses a playable controller for close, background, blur, and unmount paths', () => {
    const pause = jest.fn()
    expect(pauseVideoPlayerBestEffort({ pause })).toBe(true)
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it('never throws when pause fails, so close still proceeds', () => {
    const pause = jest.fn(() => { throw new Error('stale player') })
    expect(() => pauseVideoPlayerBestEffort({ pause })).not.toThrow()
    expect(pauseVideoPlayerBestEffort({ pause })).toBe(false)
  })

  it('ignores missing players and missing pause controls', () => {
    expect(pauseVideoPlayerBestEffort(null)).toBe(false)
    expect(pauseVideoPlayerBestEffort(undefined)).toBe(false)
    expect(pauseVideoPlayerBestEffort({})).toBe(false)
    expect(pauseVideoPlayerBestEffort({ pause: 'not-a-function' })).toBe(false)
  })
})
