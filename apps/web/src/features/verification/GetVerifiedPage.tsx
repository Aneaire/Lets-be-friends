import { Link } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { ArrowRight, BadgeDollarSign, Check, ShieldCheck, UserRound } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { BrandLogo } from '../../design-system/atoms/BrandLogo'
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
    )
    : null
  const companion = companionSetupState(application?.status)
  const identityDone = verification?.state === 'approved'
  const companionDone = companion === 'approved'
  const completedSteps = Number(identityDone) + Number(companionDone)

  return (
    <main className="verification-page">
      <header className="verification-hero">
        <div className="verification-hero-mark" aria-hidden="true">
          <BrandLogo className="verification-logo" />
        </div>
        <div className="verification-hero-copy">
          <p className="eyebrow">Trust and safety</p>
          <h1 className="text-display">Get verified</h1>
          <p className="lede">
            Confirm who you are, then create a Companion profile if you want to offer your Strengths.
            We save your progress after each step.
          </p>
        </div>
        <div className="verification-progress" aria-label={`${completedSteps} of 2 verification steps complete`}>
          <strong>{completedSteps}<span>/2</span></strong>
          <span>steps complete</span>
        </div>
      </header>

      <div className="verification-layout">
        <div className="verification-steps">
          <section className="verification-step" data-complete={identityDone} aria-labelledby="verify-identity-heading">
            <div className="verification-step-marker" aria-hidden="true">
              {identityDone ? <Check size={20} /> : <span>1</span>}
            </div>
            <div className="verification-step-body">
              <div className="verification-step-heading">
                <div className="verification-step-title">
                  <ShieldCheck size={20} aria-hidden="true" />
                  <h2 id="verify-identity-heading" className="text-h2">Identity check</h2>
                </div>
                {verification && (
                  <span className="status-pill" data-tone={verification.tone}>{verification.label}</span>
                )}
              </div>
              <p className="text-body muted">Submit a government ID and a current selfie. Only the safety team reviews them.</p>
              {!verification && (
                <div className="verification-status-loading" role="status">
                  <span className="ds-spinner" aria-hidden="true" />
                  <span>Loading identity status...</span>
                </div>
              )}
              {verification && !identityDone && (
                <>
                  <p className="verification-guidance">{verification.guidance}</p>
                  <Link
                    to="/verify-identity"
                    search={{ intent: 'member', returnTo: '/get-verified' }}
                    className="btn btn-self mt-4"
                  >
                    Verify identity <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </>
              )}
              {verification && identityDone && (
                <p className="verification-complete-copy">Your identity and safety review are approved.</p>
              )}
            </div>
          </section>

          <section className="verification-step" data-complete={companionDone} aria-labelledby="verify-companion-heading">
            <div className="verification-step-marker" aria-hidden="true">
              {companionDone ? <Check size={20} /> : <span>2</span>}
            </div>
            <div className="verification-step-body">
              <div className="verification-step-heading">
                <div className="verification-step-title">
                  <UserRound size={20} aria-hidden="true" />
                  <h2 id="verify-companion-heading" className="text-h2">Companion profile</h2>
                </div>
                <span
                  className="status-pill"
                  data-tone={companionDone ? 'success' : companion === 'pending_review' ? 'warning' : 'self'}
                >
                  {application === undefined
                    ? 'Loading...'
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
              <p className="text-body muted">Share the Strengths, session formats, availability, and boundaries you offer.</p>
              {application === undefined && (
                <div className="verification-status-loading" role="status">
                  <span className="ds-spinner" aria-hidden="true" />
                  <span>Loading Companion profile...</span>
                </div>
              )}
              {application !== undefined && !companionDone && (
                <>
                  <p className="verification-guidance">
                    {companion === 'pending_review'
                      ? 'Your application is with the review team. Approval makes your profile visible to members.'
                      : 'Create your profile and send it to the safety team for review.'}
                  </p>
                  <Link to="/become-companion" className="btn btn-self mt-4">
                    {companion === 'none' || companion === 'draft' ? 'Create Companion profile' : 'Continue application'}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </>
              )}
              {application !== undefined && companionDone && (
                <p className="verification-complete-copy">Your Companion profile is approved and visible to members.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="verification-outcome" aria-labelledby="verify-earnings-heading">
          <BadgeDollarSign size={24} aria-hidden="true" />
          <p className="eyebrow">After approval</p>
          <h2 id="verify-earnings-heading" className="text-h2">Earn with your everyday Strengths</h2>
          <p className="text-body muted">
            Approved Companions can accept bookings and earn from completed experiences. You receive the full listed service subtotal.
          </p>
          <div className="verification-outcome-rule" />
          <p className="text-meta">Withdraw available earnings to a verified bank or e-wallet account through PayMongo InstaPay.</p>
          {!companionDone && (
            <Link to="/become-companion" className="btn btn-social mt-5">
              Start your Companion profile <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </aside>
      </div>
    </main>
  )
}
