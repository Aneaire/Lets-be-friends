const UNCAUGHT_MARKERS = ['Uncaught ConvexError:', 'Uncaught Error:'] as const
const CONVEX_ENVELOPE_PREFIX = '[CONVEX'
const SERVER_ERROR_MARKER = 'Server Error '
const SERVER_ERROR_BARE = 'Server Error'
const REDACTED_ENVELOPE = /Server Error\b/
const CLIENT_SUFFIX = 'Called by client'

function stackTailStart(text: string) {
  return text.search(/\s+at\s|\s+Called by client|\r?\n/)
}

function stripStackTail(text: string) {
  const start = stackTailStart(text)
  return (start === -1 ? text : text.slice(0, start)).trim()
}

function stripUncaughtMarker(text: string) {
  for (const marker of UNCAUGHT_MARKERS) {
    const index = text.lastIndexOf(marker)
    if (index !== -1) return text.slice(index + marker.length).trim()
  }
  return null
}

function rawErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const candidate = error as { data?: unknown; message?: unknown }
    if (typeof candidate.data === 'string' && candidate.data.trim()) return candidate.data
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message
  }
  if (typeof error === 'string') return error
  return ''
}

export function compactConvexError(message: string) {
  const text = message.trim()
  const direct = stripUncaughtMarker(text)
  if (direct !== null) return stripStackTail(direct)

  if (text.startsWith(CONVEX_ENVELOPE_PREFIX)) {
    const withSpace = text.indexOf(SERVER_ERROR_MARKER)
    const redacted = text.search(REDACTED_ENVELOPE)
    let remainder: string | null = null
    if (withSpace !== -1) {
      remainder = text.slice(withSpace + SERVER_ERROR_MARKER.length).trim()
    } else if (redacted !== -1) {
      remainder = text.slice(redacted + SERVER_ERROR_BARE.length).replace(/^[:\s]+/, '').trim()
    }
    if (remainder === null) return text

    const inner = stripUncaughtMarker(remainder)
    const value = stripStackTail(inner ?? remainder)
    // Convex redacts a plain server Error's message in production, so the envelope
    // can arrive with nothing after "Server Error" but the client suffix. Returning
    // empty lets the caller's own fallback show instead of the raw envelope.
    return value === CLIENT_SUFFIX ? '' : value
  }
  return text
}

export function extractConvexErrorMessage(error: unknown, fallback: string) {
  return compactConvexError(rawErrorMessage(error)) || fallback
}

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.'

// For call sites that have no tailored fallback of their own. It never returns a
// redacted envelope: when Convex strips the server message there is nothing
// readable to show, so a plain sentence is better than the transport noise.
export function describeConvexError(error: unknown) {
  return extractConvexErrorMessage(error, DEFAULT_ERROR_MESSAGE)
}
