const MAX_ID_LENGTH = 128

function cleanId(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_ID_LENGTH) return null
  // Reject whitespace, markup, fragments, and decoded URL separators so an
  // encoded slash (%2F), query separator (%3F/%26/%3D/%23), or stray escape
  // remainder (%) never becomes a valid id. Control characters are rejected
  // explicitly because only some overlap with \s.
  if (/[\s<>"'#?&=/%\\]/.test(trimmed)) return null
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return null
  return trimmed
}

function nativePath(pathname: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return query ? `${pathname}?${query}` : pathname
}

function normalizePathname(pathname: string): string {
  if (!pathname.startsWith('/')) return `/${pathname}`
  return pathname
}

/**
 * Allowlisted mapping from website share URL paths to native Expo routes.
 *
 * Covered website paths (and only these):
 * - /social?postId (plus optional commentId)
 * - /companion-profile?companionProfileId (plus optional reviewId)
 * - /circles and /circles/<id> (plus optional postId/commentId)
 *
 * Safety rules:
 * - Custom-scheme inputs (letsbefriends://...) are treated as same-app links.
 * - Absolute http(s) URLs are accepted only when their origin matches the
 *   configured EXPO_PUBLIC_WEB_APP_URL origin. Foreign hosts return null.
 * - Unknown paths, missing required ids, and malformed URLs return null.
 * - This helper does not establish universal-link or app-link association;
 *   it only normalizes a link the OS already delivered to the app.
 */
export function normalizeWebSharePath(
  raw: string | null | undefined,
  configuredWebAppUrl?: string | null,
): string | null {
  if (!raw || typeof raw !== 'string') return null
  const input = raw.trim()
  if (!input) return null
  if (/^(javascript|data|file|ftp):/i.test(input)) return null

  let pathname: string
  let searchParams: URLSearchParams
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
      const url = new URL(input)
      // Credential-bearing URLs are never trusted as share links.
      if (url.username || url.password) return null
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        // Custom schemes (for example letsbefriends://social?postId=... and
        // letsbefriends:///social?postId=...) are same-app links. The host
        // form carries the first path segment as the URL host
        // (letsbefriends://circles/circle_7 has hostname "circles"), so
        // resolve by host plus path. Triple-slash links keep working because
        // their hostname is empty.
        if (!/^letsbefriends:/i.test(input)) return null
        if (url.port) return null
        pathname = normalizePathname(`/${url.hostname}${url.pathname}`)
        searchParams = url.searchParams
      } else {
        if (!configuredWebAppUrl) return null
        const configured = new URL(configuredWebAppUrl)
        if (url.origin !== configured.origin) return null
        pathname = normalizePathname(url.pathname)
        searchParams = url.searchParams
      }
    } else {
      // Relative app path such as /social?postId=... or social?postId=....
      // Protocol-relative URLs (//host/...) carry a foreign host and are rejected.
      if (input.startsWith('//')) return null
      const url = new URL(input, 'https://share.local')
      if (url.host !== 'share.local') return null
      pathname = normalizePathname(url.pathname)
      searchParams = url.searchParams
    }
  } catch {
    return null
  }

  // Collapse duplicate slashes and drop a single trailing slash.
  pathname = pathname.replace(/\/{2,}/g, '/')
  if (pathname.length > 1) pathname = pathname.replace(/\/$/, '')

  if (pathname === '/social') {
    const postId = cleanId(searchParams.get('postId'))
    if (!postId) return null
    const commentId = cleanId(searchParams.get('commentId'))
    if (commentId) {
      return nativePath(`/post-comments/${encodeURIComponent(postId)}`, { commentId })
    }
    return nativePath('/', { postId })
  }

  if (pathname === '/companion-profile') {
    const companionProfileId = cleanId(searchParams.get('companionProfileId'))
    if (!companionProfileId) return null
    const reviewId = cleanId(searchParams.get('reviewId'))
    return nativePath(`/companion-profile/${encodeURIComponent(companionProfileId)}`, {
      ...(reviewId ? { reviewId } : {}),
    })
  }

  if (pathname === '/circles') return '/circles'

  const circleMatch = pathname.match(/^\/circles\/([^/]+)$/)
  if (circleMatch) {
    let decoded: string
    try {
      decoded = decodeURIComponent(circleMatch[1])
    } catch {
      return null
    }
    const circleId = cleanId(decoded)
    if (!circleId) return null
    const postId = cleanId(searchParams.get('postId'))
    const commentId = cleanId(searchParams.get('commentId'))
    return nativePath(`/circles/${encodeURIComponent(circleId)}`, {
      ...(postId ? { postId } : {}),
      ...(commentId ? { commentId } : {}),
    })
  }

  return null
}
