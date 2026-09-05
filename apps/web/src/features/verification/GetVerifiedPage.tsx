import { Link } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { identityEntitlementStatus, memberVerificationPresentation } from '../../lib/memberVerification'
import { companionSetupState } from '../../lib/verificationNudge'

export function GetVerifiedPage() {
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer, isSignedIn ? {} : 'skip')
  const latestVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const application = useQuery(api.companions.myApplication, viewer ? {} : 'skip')

  if (!isSignedIn) {
    return (
      <main className="marketing-page">
        <h1 className="text-h1 mt-2">Sign in to check your verification.</h1>
        <div className="mt-6">
          <SignInButton mode="modal">
            <button className="btn btn-self">Sign in</button>
          </SignInButton>
        </div>
      </main>
    )
  }

  const verification = viewer
    ? memberVerificationPresentation(
      identityEntitlementStatus(viewer.verificationStatus, viewer.identityEligible),
      latestVerification,
      viewer.identityTestBypassActive,
    )
    : null
  const companion = companionSetupState(application?.status)
  const identityDone = verification?.state === 'approved'
  const companionDone = companion === 'approved'

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <p className="text-meta">Trust and safety</p>
        <h1 className="text-h1">Get verified</h1>
        <p className="text-body muted">
          Verification unlocks bookings, and an approved Companion profile unlocks earnings.
          Complete each step once. Your progress is saved.
        </p>
      </header>

      <div className="settings-stack">
        <section className="settings-section" aria-labelledby="verify-identity-heading">
          <div className="settings-section-heading">
            <div>
              <h2 id="verify-identity-heading" className="text-h2">Identity check</h2>
              <p className="text-meta mt-1">A private government ID check plus a current selfie, reviewed by the safety team.</p>
            </div>
            {verification && (
              <span className="status-pill" data-tone={verification.tone}>{verification.label}</span>
            )}
          </div>
          {!verification && <p className="text-meta">Loading your identity status…</p>}
          {verification && !identityDone && (
            <>
              <p className="text-body muted">{verification.guidance}</p>
              <Link
                to="/verify-identity"
                search={{ intent: 'member', returnTo: '/get-verified' }}
                className="btn btn-self mt-3"
              >
                Verify identity
              </Link>
            </>
          )}
          {verification && identityDone && (
            <p className="text-body muted">Your identity check and safety review are approved. Nothing left to do here.</p>
          )}
        </section>

        <section className="settings-section" aria-labelledby="verify-companion-heading">
          <div className="settings-section-heading">
            <div>
              <h2 id="verify-companion-heading" className="text-h2">Companion profile</h2>
              <p className="text-meta mt-1">Approval makes your profile visible to members and starts your earnings.</p>
            </div>
            <span
              className="status-pill"
              data-tone={companionDone ? 'success' : companion === 'pending_review' ? 'warning' : 'self'}
            >
              {application === undefined
                ? 'Loading…'
                : companion === 'approved'
                  ? 'Approved'
                  : companion === 'pending_review'
                    ? 'In review'
                    : companion === 'rejected'
                      ? 'Needs changes'
                      : companion === 'suspended'
                        ? 'Suspended'
                        : 'Not started'}
            </span>
          </div>
          {application === undefined && <p className="text-meta">Loading your Companion profile…</p>}
          {application !== undefined && !companionDone && (
            <>
              <p className="text-body muted">
                {companion === 'pending_review'
                  ? 'Your application is with the review team. Approval makes your profile visible to members.'
                  : 'Describe the everyday help and Strengths you can offer, then send your profile for review. Applying starts review and does not guarantee approval.'}
              </p>
              <Link to="/become-companion" className="btn btn-self mt-3">
                {companion === 'none' || companion === 'draft' ? 'Create Companion profile' : 'Continue application'}
              </Link>
            </>
          )}
          {application !== undefined && companionDone && (
            <p className="text-body muted">Your Companion profile is approved and visible to members.</p>
          )}
        </section>

        <section className="settings-section" aria-labelledby="verify-earnings-heading">
          <div className="settings-section-heading">
            <div>
              <h2 id="verify-earnings-heading" className="text-h2">Earn with the skills you already use</h2>
              <p className="text-meta mt-1">Everyday Strengths, shared on your terms.</p>
            </div>
          </div>
          <p className="text-body muted">
            Companions earn from completed experiences, and the Companion entitlement is 100% of each listed
            service subtotal. Cooking, sightseeing, friendly company, and the other Strengths in your daily
            life can become paid sessions once your profile is approved.
          </p>
          <p className="text-body muted mt-2">
            Finish verification above, keep your boundaries clear, and withdrawals move your available
            earnings to your verified bank or e-wallet account through PayMongo InstaPay.
          </p>
          {!companionDone && (
            <Link to="/become-companion" className="btn btn-social mt-3">
              Start earning as a Companion
            </Link>
          )}
        </section>
      </div>
    </main>
  )
}
