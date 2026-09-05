import { useAuth, useClerk, useUser } from '@clerk/react'
import { useRouterState } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { api } from '../../../convex/_generated/api'
import { BrandLogo } from '../../design-system/atoms/BrandLogo'
import { onboardingGateDecision } from '../../lib/onboarding'

export const ONBOARDING_RECOVERY_DELAY_MS = 15_000

export function replaceWithOnboarding(location: Pick<Location, 'replace'> = window.location) {
  location.replace('/onboarding')
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { isLoaded: clerkLoaded, isSignedIn, userId } = useAuth()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { isLoading: convexLoading, isAuthenticated: convexAuthenticated } = useConvexAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const ensureViewer = useMutation(api.users.ensureViewer)
  const viewer = useQuery(api.users.viewer, isSignedIn && convexAuthenticated ? {} : 'skip')
  const attemptedIdentity = useRef<string | null>(null)
  const provisionFlight = useRef<Promise<void> | null>(null)
  const [provisioning, setProvisioning] = useState(false)
  const [provisionError, setProvisionError] = useState('')
  const [recoveryReady, setRecoveryReady] = useState(false)

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
    // Single-flight: an automatic attempt plus a manual retry (or a
    // double-clicked retry) must never start concurrent ensureViewer calls.
    // Late joiners await the in-flight attempt instead of starting a new one.
    if (provisionFlight.current) {
      try {
        await provisionFlight.current
      } catch {
        // The owning attempt already surfaced the error.
      }
      return
    }
    attemptedIdentity.current = userId
    setProvisioning(true)
    setProvisionError('')
    const flight = (async () => {
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
    })()
    provisionFlight.current = flight
    try {
      await flight
    } finally {
      if (provisionFlight.current === flight) provisionFlight.current = null
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
    if (decision === 'redirect_onboarding') replaceWithOnboarding()
  }, [decision])

  useEffect(() => {
    setRecoveryReady(false)
    if (decision !== 'loading' && decision !== 'provision') return
    if (decision === 'provision' && provisionError && !provisioning) return
    const timer = window.setTimeout(() => setRecoveryReady(true), ONBOARDING_RECOVERY_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [decision, userId, clerkLoaded, convexLoading, provisionError, provisioning])

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
      <div className="gate-state-inner gate-state-loading">
        <div className="gate-state-logo-stage" aria-hidden="true">
          <BrandLogo className="gate-state-logo" />
          <span className="gate-state-logo-ring" />
        </div>
        <div>
          <p className="eyebrow">Let&apos;s Be Friends</p>
          <h1 className="text-h2 mt-2">Getting things ready</h1>
          <div className="gate-state-loading-status mt-3" role="status" aria-live="polite" aria-atomic="true">
            <span>{decision === 'redirect_onboarding' ? 'Opening your welcome guide...' : 'Preparing your account...'}</span>
          </div>
        </div>
        {recoveryReady && decision !== 'redirect_onboarding' && (
          <div className="gate-state-recovery mt-5">
            <p className="text-body muted">This is taking longer than expected. You can retry setup or reload this page. You stay signed in.</p>
            <div className="gate-state-actions mt-3">
              <button type="button" className="btn btn-self" onClick={() => void provision()}>
                Retry account setup
              </button>
              <button type="button" className="btn btn-neutral" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
