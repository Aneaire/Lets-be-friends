// Classifies errors that mean the signed-in session can no longer be used, so
// the app error boundary can end the session gracefully instead of letting an
// uncaught render error kill the release build.
//
// Account deletion sets `suspended` on the member row, so every query routed
// through `requireViewer` starts throwing "Account is suspended" the moment the
// deletion mutation commits. Without this classifier those errors crash React
// Native in production builds.

const SESSION_ENDED_PATTERNS: RegExp[] = [
  /account is suspended/i,
]

export function isSessionEndedError(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause ?? '')
  return SESSION_ENDED_PATTERNS.some((pattern) => pattern.test(message))
}

export function shouldSignOutOnSessionEndedError({
  authStatus,
  deletionInProgress,
}: {
  authStatus: string
  deletionInProgress: boolean
}): boolean {
  if (deletionInProgress) return false
  return authStatus === 'signed_in' || authStatus === 'needs_task'
}

export function sessionEndedFallbackCopy() {
  return {
    eyebrow: 'ACCOUNT',
    title: 'Your session has ended',
    detail: 'This account is closed. Sign in with a different account to continue.',
    actionLabel: 'Sign in again',
  }
}

export function genericErrorFallbackCopy() {
  return {
    eyebrow: 'SOMETHING WENT WRONG',
    title: 'The app hit an unexpected problem',
    detail: 'Your data is safe. You can try again, or close and reopen the app.',
    actionLabel: 'Try again',
  }
}
