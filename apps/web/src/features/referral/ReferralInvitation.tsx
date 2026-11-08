import { Link } from '@tanstack/react-router'
import { useAuth } from '@clerk/react'
import { normalizeReferralCode, referralCodeValidationError } from '@lets-be-friends/shared'
import { SignInAction } from '../auth/SignInAction'

export function ReferralInvitation({ code }: { code?: string }) {
  const { isSignedIn } = useAuth()
  const normalized = normalizeReferralCode(code ?? '')
  const valid = !referralCodeValidationError(normalized)

  return (
    <main className="referral-invitation">
      <section className="referral-invitation-hero" aria-labelledby="invitation-title">
        <div className="referral-invitation-copy">
          <p className="eyebrow">A little invitation for you</p>
          <h1 id="invitation-title" className="text-display">Good company starts here.</h1>
          <p className="lede">A friend invited you to Let’s Be Friends. Find everyday help, share an activity, and make room for a new connection.</p>
          <div className="referral-invitation-code">
            {valid ? (
              <><span>YOUR INVITATION CODE</span><strong>{normalized}</strong><p>Keep this code handy when you join.</p></>
            ) : (
              <><span>INVITATION CODE</span><p>This invitation code is missing or invalid. You can still explore and join.</p></>
            )}
          </div>
          <div className="referral-invitation-actions">
            {isSignedIn ? <Link to="/social" className="btn btn-social btn-lg">Continue to your account</Link> : <SignInAction className="btn btn-social btn-lg">Join or sign in</SignInAction>}
            <Link to="/safety" className="btn btn-ghost">How safety works</Link>
          </div>
        </div>
        <figure className="referral-invitation-image">
          <img src="/images/marketing/market-friends.webp" alt="Two friends laughing while exploring a neighborhood market together" width={1536} height={1024} />
          <figcaption>Make a plan. Share the moment.</figcaption>
        </figure>
      </section>
      <section className="referral-invitation-details" aria-labelledby="invitation-next-title">
        <div>
          <p className="eyebrow">A welcoming place to start</p>
          <h2 id="invitation-next-title" className="text-h1">A little easier together.</h2>
        </div>
        <div className="referral-invitation-steps">
          <article><span>01</span><h3>Join the community</h3><p>Create your account and share a little about yourself.</p></article>
          <article><span>02</span><h3>Find your fit</h3><p>Explore Companions, their Strengths, and the experiences they offer.</p></article>
          <article><span>03</span><h3>Make a plan</h3><p>Choose an online or in-person session that feels right for you.</p></article>
        </div>
      </section>
    </main>
  )
}
