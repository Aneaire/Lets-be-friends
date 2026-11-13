import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { extractConvexErrorMessage } from '../../lib/convexErrors'

const COMPLETION_ERROR_FALLBACK = 'Completion could not be confirmed. Try again.'
const MINUTE_MS = 60_000
const CLOCK_REFRESH_MS = 30_000

type BookingCompletionActionProps = {
  onComplete: () => Promise<void>
  requestedAt: number
  durationMinutes: number
}

function sessionEndAt(requestedAt: number, durationMinutes: number) {
  if (
    !Number.isSafeInteger(requestedAt)
    || !Number.isSafeInteger(durationMinutes)
    || durationMinutes <= 0
  ) {
    return null
  }
  const durationMs = durationMinutes * MINUTE_MS
  const endAt = requestedAt + durationMs
  if (!Number.isSafeInteger(durationMs) || !Number.isSafeInteger(endAt)) return null
  return endAt
}

function formatPhtTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}

// The server refuses a completion confirmation until the scheduled session has
// ended. The same check runs here first, and the control stays disabled until
// then so the wait is visible instead of arriving as a rejection.
export function BookingCompletionAction({ onComplete, requestedAt, durationMinutes }: BookingCompletionActionProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const inFlightRef = useRef(false)
  const endAt = sessionEndAt(requestedAt, durationMinutes)
  const sessionEnded = endAt === null || now >= endAt
  const endsAtLabel = endAt === null ? null : formatPhtTime(endAt)

  useEffect(() => {
    if (endAt === null || now >= endAt) return
    const timer = setTimeout(() => setNow(Date.now()), CLOCK_REFRESH_MS)
    return () => clearTimeout(timer)
  }, [endAt, now])

  const confirmCompletion = useCallback(async () => {
    if (inFlightRef.current) return
    if (!sessionEnded) {
      toast.warning(endsAtLabel ? `You can confirm completion after ${endsAtLabel}.` : 'Your session is not done yet.')
      return
    }
    inFlightRef.current = true
    setPending(true)
    setError('')
    try {
      await onComplete()
      setError('')
    } catch (cause) {
      setError(extractConvexErrorMessage(cause, COMPLETION_ERROR_FALLBACK))
    } finally {
      inFlightRef.current = false
      setPending(false)
    }
  }, [endsAtLabel, onComplete, sessionEnded])

  return (
    <>
      {error && (
        <div className="notice notice-danger text-meta w-full" role="alert">
          <span className="notice-icon">!</span>
          <span>{error}</span>
        </div>
      )}
      <button
        type="button"
        className="btn btn-social btn-sm"
        onClick={() => void confirmCompletion()}
        disabled={pending || !sessionEnded}
        aria-busy={pending}
      >
        {pending ? 'Confirming completion…' : sessionEnded ? 'Confirm completion' : `Confirm after ${endsAtLabel} PHT`}
      </button>
    </>
  )
}
