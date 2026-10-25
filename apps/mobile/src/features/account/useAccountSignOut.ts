import { useEffect, useMemo, useRef, useState } from 'react'

import {
  createAccountSignOutCoordinator,
  runAccountSignOut,
  type AccountSignOutOutcome,
  type AccountSignOutSession,
} from './accountSheet'

let nextAccountGeneration = 1

/**
 * Shared sign-out state for the Home Account sheet and the Settings row.
 * The in-flight guard lives in a ref so duplicate taps in the same tick run
 * auth cleanup once. Busy and error reset whenever the account identity
 * changes, so a stale account never owns the UI.
 */
export function useAccountSignOut({
  accountId,
  signOut,
  onSignedOut,
}: {
  accountId: string
  signOut: (() => Promise<void>) | null
  onSignedOut?: () => void
}) {
  const coordinatorRef = useRef(createAccountSignOutCoordinator())
  const generation = useMemo(() => nextAccountGeneration++, [accountId])
  const liveRef = useRef({ accountId, generation })
  liveRef.current = { accountId, generation }
  const mountedRef = useRef(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      coordinatorRef.current.cancel()
    }
  }, [])

  useEffect(() => {
    coordinatorRef.current.cancel()
    setSigningOut(false)
    setSignOutError(false)
  }, [generation])

  async function runSignOut(): Promise<AccountSignOutOutcome> {
    const session: AccountSignOutSession = { accountId, generation, flightId: Symbol('account-sign-out') }
    const isCurrent = (candidate: AccountSignOutSession) => (
      mountedRef.current
      && liveRef.current.accountId === candidate.accountId
      && liveRef.current.generation === candidate.generation
    )
    if (!isCurrent(session) || signOut === null) return 'stale'
    setSignOutError(false)
    setSigningOut(true)
    const outcome = await runAccountSignOut({
      session,
      coordinator: coordinatorRef.current,
      isCurrent,
      signOut,
    })
    if (outcome === 'duplicate') return outcome
    if (outcome === 'stale' || !isCurrent(session)) return 'stale'
    setSigningOut(false)
    if (outcome === 'failed') {
      setSignOutError(true)
      return outcome
    }
    onSignedOut?.()
    return outcome
  }

  return { signingOut, signOutError, runSignOut }
}
