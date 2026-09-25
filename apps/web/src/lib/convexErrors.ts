const UNCAUGHT_MARKERS = ['Uncaught ConvexError:', 'Uncaught Error:'] as const
const CONVEX_ENVELOPE_PREFIX = '[CONVEX'
const SERVER_ERROR_MARKER = 'Server Error '

function stackTailStart(text: string) {
  return text.search(/\s+at\s|\s+Called by client|\r?\n/)
}

function stripStackTail(text: string) {
  const start = stackTailStart(text)
  return (start === -1 ? text : text.slice(0, start)).trim()
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
  for (const marker of UNCAUGHT_MARKERS) {
    const index = text.lastIndexOf(marker)
    if (index !== -1) return stripStackTail(text.slice(index + marker.length).trim())
  }
  if (text.startsWith(CONVEX_ENVELOPE_PREFIX)) {
    const serverError = text.indexOf(SERVER_ERROR_MARKER)
    if (serverError !== -1) {
      return stripStackTail(text.slice(serverError + SERVER_ERROR_MARKER.length).trim())
    }
  }
  return text
}

export function extractConvexErrorMessage(error: unknown, fallback: string) {
  return compactConvexError(rawErrorMessage(error)) || fallback
}
