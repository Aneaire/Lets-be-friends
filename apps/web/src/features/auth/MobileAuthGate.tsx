import { SignInButton, useAuth } from '@clerk/react'
import type React from 'react'
import { BrandLogo } from '../../design-system/atoms/BrandLogo'

export function MobileAuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth()

  if (isSignedIn) return children

  return (
    <>
      <main className="mobile-auth-gate">
        <section className="mobile-auth-gate-panel" aria-labelledby="mobile-auth-title">
          <div className="mobile-auth-gate-brand">
            <BrandLogo className="mobile-auth-gate-logo" />
            <span>Let&apos;s Be Friends</span>
          </div>

          <div className="mobile-auth-gate-copy">
            <p className="eyebrow">Your account</p>
            <h1 id="mobile-auth-title">Sign in to continue.</h1>
            <p>Meet Companions, manage bookings, and keep your conversations in one place.</p>
          </div>

          <SignInButton mode="modal">
            <button type="button" className="btn btn-self mobile-auth-gate-action">
              Sign in
            </button>
          </SignInButton>
        </section>
      </main>
      <div className="mobile-auth-guarded-content">{children}</div>
    </>
  )
}
