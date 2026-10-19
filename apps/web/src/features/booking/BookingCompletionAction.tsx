import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { extractConvexErrorMessage } from '../../lib/convexErrors'

const COMPLETION_ERROR_FALLBACK = 'Completion could not be confirmed. Try again.'
const MINUTE_MS = 60_000

type BookingCompletionActionProps = {
  onComplete: () => Promise<void>
  requestedAt: number
  durationMinutes: number
}

// The server refuses a completion confirmation until the scheduled session has
// ended. The same check runs here first so the wait is explained in plain words
// instead of arriving as a server rejection.
function sessionNotEndedMessage(requestedAt: number, durationMinutes: number, now: number) {
  if (
    !Number.isSafeInteger(requestedAt)
    || !Number.isSafeInteger(durationMinutes)
    || durationMinutes <= 0
  ) {
    return null
  }
  const durationMs = durationMinutes * MINUTE_MS
  const scheduledEndAt = requestedAt + durationMs
  if (!Number.isSafeInteger(durationMs) || !Number.isSafeInteger(scheduledEndAt) || now >= scheduledEndAt) {
    return null
  }
  const endsAt = new Date(scheduledEndAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `Your session is not done yet. You can confirm completion after ${endsAt}.`
}

export function BookingCompletionAction({ onComplete, requestedAt, durationMinutes }: BookingCompletionActionProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inFlightRef = useRef(false)

  const confirmCompletion = useCallback(async () => {
    if (inFlightRef.current) return
    const notEnded = sessionNotEndedMessage(requestedAt, durationMinutes, Date.now())
    if (notEnded) {
      setError('')
      toast.warning(notEnded)
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
  }, [durationMinutes, onComplete, requestedAt])

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
        className="btn btn-social-quiet btn-sm"
        onClick={() => void confirmCompletion()}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? 'Confirming completion…' : 'Confirm completion'}
      </button>
    </>
  )
}
