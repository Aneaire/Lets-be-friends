import { useCallback, useRef, useState } from 'react'
import { extractConvexErrorMessage } from '../../lib/convexErrors'

const COMPLETION_ERROR_FALLBACK = 'Completion could not be confirmed. Try again.'

type BookingCompletionActionProps = {
  onComplete: () => Promise<void>
}

export function BookingCompletionAction({ onComplete }: BookingCompletionActionProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inFlightRef = useRef(false)

  const confirmCompletion = useCallback(async () => {
    if (inFlightRef.current) return
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
  }, [onComplete])

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
