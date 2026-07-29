import { useAuth, useClerk, useUser } from '@clerk/react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { api } from '../../convex/_generated/api'
import { onboardingGateDecision } from '../lib/onboarding'

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { isLoaded: clerkLoaded, isSignedIn, userId } = useAuth()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { isLoading: convexLoading, isAuthenticated: convexAuthenticated } = useConvexAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()
  const ensureViewer = useMutation(api.users.ensureViewer)
  const viewer = useQuery(api.users.viewer, isSignedIn && convexAuthenticated ? {} : 'skip')
  const attemptedIdentity = useRef<string | null>(null)
  const [provisioning, setProvisioning] = useState(false)
  const [provisionError, setProvisionError] = useState('')

  const decision = onboardingGateDecision({
    clerkLoaded,
    signedIn: Boolean(isSignedIn),
    clerkUserId: userId,
    convexLoading,
    convexAuthenticated,
    viewer,
    pathname,
  })

  const provision = useCallback(async () => {
    if (!userId) return
    attemptedIdentity.current = userId
    setProvisioning(true)
    setProvisionError('')
    try {
      await ensureViewer({
        displayName: user?.fullName ?? user?.username ?? 'New friend',
        expectedClerkUserId: userId,
      })
    } catch (error) {
      setProvisionError(error instanceof Error ? error.message : 'Account setup failed. Please try again.')
    } finally {
      setProvisioning(false)
    }
  }, [ensureViewer, user, userId])

  useEffect(() => {
    if (attemptedIdentity.current && attemptedIdentity.current !== userId) {
      attemptedIdentity.current = null
      setProvisionError('')
    }
    if (decision === 'provision' && userId && attemptedIdentity.current !== userId) void provision()
  }, [decision, provision, userId])

  useEffect(() => {
    if (decision === 'redirect_onboarding') void navigate({ to: '/onboarding', replace: true })
  }, [decision, navigate])

  if (decision === 'allow') return children

  if (decision === 'auth_error' || decision === 'identity_mismatch') {
    const identityMismatch = decision === 'identity_mismatch'
    return (
      <main className="gate-state" aria-live="assertive">
        <div className="gate-state-inner">
          <p className="eyebrow">Account connection</p>
          <h1 className="text-h1 mt-2">
            {identityMismatch ? 'Your signed-in account changed.' : 'We couldn’t confirm your sign-in.'}
          </h1>
          <p className="lede mt-2">
            {identityMismatch
              ? 'Reload to reconnect this page to your current account, or sign out and start again.'
              : 'Reload to try connecting again. If that does not work, sign out and sign back in.'}
          </p>
          <div className="gate-state-actions mt-5">
            <button type="button" className="btn btn-self" onClick={() => window.location.reload()}>
              Reload and retry
            </button>
            <button type="button" className="btn btn-neutral" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (decision === 'provision' && provisionError && !provisioning) {
    return (
      <main className="gate-state" aria-live="polite">
        <div className="gate-state-inner">
          <p className="eyebrow">Account setup</p>
          <h1 className="text-h1 mt-2">We couldn&apos;t finish setting up your account.</h1>
          <p className="lede mt-2">{provisionError}</p>
          <button type="button" className="btn btn-self mt-5" onClick={() => void provision()}>
            Retry account setup
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="gate-state" aria-live="polite" aria-busy="true">
      <div className="gate-state-inner">
        <p className="eyebrow">Let&apos;s Be Friends</p>
        <p className="text-body muted mt-3">
          {decision === 'redirect_onboarding' ? 'Opening your welcome guide…' : 'Preparing your account…'}
        </p>
      </div>
    </main>
  )
}
