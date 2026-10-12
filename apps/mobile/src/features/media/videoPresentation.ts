export const VIDEO_VIEWER_DEFAULT_TITLE = 'Video'

export const VIDEO_VIEWER_CLOSE_LABEL = 'Close video viewer'

export const VIDEO_VIEWER_ERROR_MESSAGE =
  'This video could not be played. Check your connection and try again.'

export const VIDEO_VIEWER_RETRY_LABEL = 'Try again'

export const VIDEO_VIEWER_UNAVAILABLE_MESSAGE = 'This video is no longer available.'

export type NativeVideoViewerProps = {
  url: string | null
  title?: string | null
  onClose: () => void
}

export function normalizeVideoUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}

export function isPlayableVideoUrl(url: string | null | undefined): boolean {
  return normalizeVideoUrl(url) !== null
}

export function isVideoViewerOpen(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.trim().length > 0
}

export function resolveVideoViewerTitle(title: string | null | undefined): string {
  const trimmed = typeof title === 'string' ? title.trim() : ''
  return trimmed ? trimmed : VIDEO_VIEWER_DEFAULT_TITLE
}

export function resolveVideoViewerAccessibilityLabel(title: string | null | undefined): string {
  return `${resolveVideoViewerTitle(title)} video player`
}

export function shouldPauseVideoForAppState(appState: string): boolean {
  return appState !== 'active'
}

export type VideoSourceState = {
  url: string | null
  retryToken: number
}

/**
 * Decides whether the native player needs its source replaced. The player is
 * created with the current URL, so the initial mount (previous and next
 * identical) must not replace the source again. URL transitions and retry
 * bumps replace exactly once.
 */
export function shouldReplaceVideoSource(previous: VideoSourceState, next: VideoSourceState): boolean {
  if (!next.url) return false
  return previous.url !== next.url || previous.retryToken !== next.retryToken
}

/**
 * Pauses playback without throwing. Closing, backgrounding, navigation blur,
 * and unmount all pause best effort; errors surface through the player status
 * or the viewer error state instead.
 */
export function pauseVideoPlayerBestEffort(player: unknown): boolean {
  try {
    if (!player || typeof player !== 'object') return false
    const pause = (player as { pause?: unknown }).pause
    if (typeof pause !== 'function') return false
    ;(pause as () => void).call(player)
    return true
  } catch {
    return false
  }
}

export function nextVideoRetryToken(token: number): number {
  if (!Number.isSafeInteger(token) || token < 0) return 1
  return token + 1
}
