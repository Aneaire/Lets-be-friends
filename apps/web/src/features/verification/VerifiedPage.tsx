import { Link } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { ArrowRight, CalendarCheck, Check, Compass, ShieldCheck } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { BrandLogo } from '../../design-system/atoms/BrandLogo'
import { OpenableImage } from '../../design-system/molecules/OpenableImage'
import { identityEntitlementStatus, memberVerificationPresentation } from '../../lib/memberVerification'

// The happy path of a verification approval, reached from the "Identity
// verification approved" notification. The page is not linked from navigation;
// the notification destination is the only entry point. Members without a
// current approval see an honest status message instead of the celebration.
export function VerifiedPage() {
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer, isSignedIn ? {} : 'skip')
  const latestVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')

  if (!isSignedIn) {
    return (
      <main className="verified-page">
        <section className="verified-gate" aria-labelledby="verified-gate-heading">
          <ShieldCheck size={28} aria-hidden="true" />
          <p className="eyebrow">Private to your account</p>
          <h1 id="verified-gate-heading" className="text-h1">Sign in to see your verification result.</h1>
          <p className="text-body muted">Your identity check stays connected to your member account and is never public.</p>
          <SignInButton mode="modal"><button type="button" className="btn btn-self">Sign in to continue</button></SignInButton>
        </section>
      </main>
    )
  }

  if (viewer === undefined || latestVerification === undefined) {
    return <main className="verified-page"><div className="identity-loading">Checking your verification status...</div></main>
  }

  const verification = memberVerificationPresentation(
    identityEntitlementStatus(viewer?.verificationStatus ?? 'not_started', viewer?.identityEligible ?? false),
    latestVerification,
  )

  if (!viewer || verification.state !== 'approved') {
    return (
      <main className="verified-page">
        <section className="verified-gate" aria-labelledby="verified-pending-heading">
          <ShieldCheck size={28} aria-hidden="true" />
          <p className="eyebrow">Not approved yet</p>
          <h1 id="verified-pending-heading" className="text-h1">{verification.label}</h1>
          <p className="text-body muted">{verification.guidance}</p>
          <Link to="/get-verified" className="btn btn-self">
            {verification.action === 'continue' ? 'Continue identity check' : verification.action === 'retry' ? 'Start a new identity check' : 'Review your verification status'}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="verified-page">
      <VerifiedCelebration />
    </main>
  )
}

// Pure presentation for a member with a current approval. Kept separate from the
// connected page so the celebration can be reviewed and browser-tested on its
// own, including its generated imagery.
export function VerifiedCelebration() {
  return (
    <>
      <header className="verified-hero">
        <div className="verified-hero-mark" aria-hidden="true">
          <BrandLogo className="verified-logo" />
          <span className="verified-hero-check"><Check size={20} /></span>
        </div>
        <div className="verified-hero-copy">
          <p className="eyebrow">Identity approved</p>
          <h1 id="verified-heading" className="text-display">You are verified. Start making friends.</h1>
          <p className="lede">
            Your identity check passed safety review. You can now explore people, send your first booking request, and share your own Strengths as a Companion.
          </p>
        </div>
      </header>

      <figure className="verified-figure">
        <OpenableImage
          src="/images/verification/frienday-verified-hero-1024.webp"
          srcSet="/images/verification/frienday-verified-hero-768.webp 768w, /images/verification/frienday-verified-hero-1024.webp 1024w"
          sizes="(max-width: 900px) calc(100vw - 1.75rem), 62rem"
          alt="Two people who just met greeting each other warmly over coffee in a bright public cafe"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          width={1024}
          height={768}
          className="verified-figure-image"
        />
        <figcaption>Every booking starts with a clear plan and a public place, so the first meeting stays easy and relaxed.</figcaption>
      </figure>

      <section className="verified-steps" aria-labelledby="verified-steps-heading">
        <div className="verified-steps-heading">
          <div>
            <p className="eyebrow">Your first steps</p>
            <h2 id="verified-steps-heading" className="text-h1">Three easy ways to begin</h2>
          </div>
          <p className="lede">You choose the people, the plan, and the pace. Nothing is scheduled without your request.</p>
        </div>

        <ol className="verified-step-grid">
          <li className="verified-step-card">
            <OpenableImage
              src="/images/verification/frienday-verified-meet-1024.webp"
              srcSet="/images/verification/frienday-verified-meet-768.webp 768w, /images/verification/frienday-verified-meet-1024.webp 1024w"
              sizes="(max-width: 700px) calc(100vw - 1.75rem), (max-width: 980px) calc(50vw - 1.5rem), 30vw"
              alt="Two people laughing together in conversation in a bright public cafe"
              loading="lazy"
              decoding="async"
              width={1024}
              height={768}
              className="verified-step-image"
            />
            <div className="verified-step-body">
              <span className="verified-step-number"><Compass size={18} aria-hidden="true" /></span>
              <h3 className="text-h3">Find someone to spend time with</h3>
              <p className="text-body muted">Browse people by Strength, activity, session format, and city. Read how they describe their time before you decide.</p>
              <Link to="/discover" className="verified-step-link">Explore people <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </li>

          <li className="verified-step-card">
            <OpenableImage
              src="/images/verification/frienday-verified-plan-1024.webp"
              srcSet="/images/verification/frienday-verified-plan-768.webp 768w, /images/verification/frienday-verified-plan-1024.webp 1024w"
              sizes="(max-width: 700px) calc(100vw - 1.75rem), (max-width: 980px) calc(50vw - 1.5rem), 30vw"
              alt="A person planning a session on a phone beside a notebook and a cup of coffee at home"
              loading="lazy"
              decoding="async"
              width={1024}
              height={768}
              className="verified-step-image"
            />
            <div className="verified-step-body">
              <span className="verified-step-number"><CalendarCheck size={18} aria-hidden="true" /></span>
              <h3 className="text-h3">Send your first booking request</h3>
              <p className="text-body muted">Pick a day, a duration, and how you would like to meet. You see the full price before anything is sent.</p>
              <Link to="/app" search={{}} className="verified-step-link">Plan a booking <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </li>

          <li className="verified-step-card">
            <OpenableImage
              src="/images/verification/frienday-verified-online-1024.webp"
              srcSet="/images/verification/frienday-verified-online-768.webp 768w, /images/verification/frienday-verified-online-1024.webp 1024w"
              sizes="(max-width: 700px) calc(100vw - 1.75rem), (max-width: 980px) calc(50vw - 1.5rem), 30vw"
              alt="Two people enjoying a friendly online session together on a laptop video call"
              loading="lazy"
              decoding="async"
              width={1024}
              height={768}
              className="verified-step-image"
            />
            <div className="verified-step-body">
              <span className="verified-step-number"><ShieldCheck size={18} aria-hidden="true" /></span>
              <h3 className="text-h3">Meet online or in a public place</h3>
              <p className="text-body muted">An online session is an easy first step. For in-person plans, keep the first meeting public and share the plan with someone you trust.</p>
              <Link to="/safety" className="verified-step-link">How safety works <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </li>
        </ol>
      </section>

      <section className="verified-actions" aria-labelledby="verified-actions-heading">
        <div>
          <h2 id="verified-actions-heading" className="text-h2">You are ready when you are.</h2>
          <p className="text-body muted">Take your time, look around, and start with whichever step feels comfortable.</p>
        </div>
        <div className="verified-actions-buttons">
          <Link to="/discover" className="btn btn-social btn-lg">Explore people <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link to="/profile" className="btn btn-self-quiet">Review your member profile</Link>
        </div>
      </section>

      <p className="verified-next-level text-meta">
        Want to offer your own Strengths? <Link to="/become-companion" className="verified-inline-link">Create a Companion profile</Link> and it appears in discovery right away.
      </p>
    </>
  )
}
