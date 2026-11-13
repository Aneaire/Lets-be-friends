import { SignInButton, useAuth } from '@clerk/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ChevronLeft, Infinity, Share2, UserPlus, Wallet } from 'lucide-react'

import { api } from '../../convex/_generated/api'
import { ReferralPanel } from '../features/referral/ReferralPanel'

export const Route = createFileRoute('/referrals')({ component: ReferralsPage })

function ReferralHeroCopy({ signedOut = false }: { signedOut?: boolean }) {
  return (
    <div className="referral-hero-copy">
      <p className="eyebrow">Good company is better shared</p>
      <h2 id="referral-hero-heading" className="text-h2">Invite a friend to find their people.</h2>
      <p className="text-body">
        Some of the best connections start with a friend's recommendation. Share your link and help someone find their next good conversation.
      </p>
      <ul className="referral-hero-points">
        <li>
          <Infinity size={18} aria-hidden="true" />
          <span><strong>5% for life.</strong> Earn 5% of the booking subtotal on every completed booking your friend makes.</span>
        </li>
        <li>
          <Wallet size={18} aria-hidden="true" />
          <span><strong>No cap.</strong> Every friend and every completed booking counts.</span>
        </li>
        <li>
          <UserPlus size={18} aria-hidden="true" />
          <span><strong>Credit after each booking.</strong> Rewards land in your wallet after a booking settles and clears a 14-day hold.</span>
        </li>
      </ul>
      {signedOut && (
        <SignInButton mode="modal">
          <button className="btn btn-self referral-hero-cta">Sign in to get your link</button>
        </SignInButton>
      )}
    </div>
  )
}

function ReferralHero({ signedOut = false }: { signedOut?: boolean }) {
  return (
    <section className="referral-hero" aria-labelledby="referral-hero-heading">
      <ReferralHeroCopy signedOut={signedOut} />
      <figure className="referral-hero-figure">
        <img
          src="/images/marketing/referral-picnic-filipino-friends.webp"
          srcSet="/images/marketing/referral-picnic-filipino-friends-768.webp 768w, /images/marketing/referral-picnic-filipino-friends.webp 1536w"
          sizes="(max-width: 860px) calc(100vw - 2rem), 30rem"
          alt="Three Filipino friends laughing together over a picnic in a sunny park"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          width={1536}
          height={1024}
        />
        <figcaption>Good company is easy to share.</figcaption>
      </figure>
    </section>
  )
}

function ReferralSteps() {
  return (
    <section className="referral-how" aria-labelledby="referral-how-heading">
      <div className="referral-how-heading">
        <div>
          <p className="eyebrow">How it works</p>
          <h2 id="referral-how-heading" className="text-h2">One link. Three quick steps.</h2>
        </div>
        <p className="text-meta">
          Your friend pays the normal price. You earn after each booking is completed and settles.
        </p>
      </div>
      <ol className="referral-steps">
        <li className="referral-step">
          <span className="referral-step-number" aria-hidden="true">1</span>
          <Share2 size={20} aria-hidden="true" />
          <h3 className="text-h3">Share your link</h3>
          <p className="text-meta">Send it to a friend who would enjoy finding good company here.</p>
        </li>
        <li className="referral-step">
          <span className="referral-step-number" aria-hidden="true">2</span>
          <UserPlus size={20} aria-hidden="true" />
          <h3 className="text-h3">They join with your code</h3>
          <p className="text-meta">Your friend signs up and books their first experience at the normal price.</p>
        </li>
        <li className="referral-step">
          <span className="referral-step-number" aria-hidden="true">3</span>
          <Infinity size={20} aria-hidden="true" />
          <h3 className="text-h3">You earn 5% for life</h3>
          <p className="text-meta">Every completed booking adds 5% of the booking subtotal to your wallet, with no cap. Credit releases after a 14-day hold.</p>
        </li>
      </ol>
    </section>
  )
}

function ReferralFinePrint() {
  return (
    <p className="text-meta referral-fine-print">
      Example: a ₱700 booking subtotal earns ₱35. The member also pays the 15% service fee, and the credit comes from that fee. Referral credit is added to your wallet after each booking settles and clears a 14-day hold. It is reversed if an admin reverses the credit or confirms fraud. The 5% rate applies to the booking subtotal, not the member total including the service fee. Read the <Link to="/referral-terms" className="underline">referral terms</Link>.
    </p>
  )
}

function ReferralsPausedNotice() {
  return (
    <div className="notice notice-danger" role="status">
      <span className="notice-icon">!</span>
      <span>Referrals are paused right now. New referral codes cannot be added until the program reopens. Existing referral credit still settles and releases.</span>
    </div>
  )
}

export function ReferralsPage() {
  const { isSignedIn } = useAuth()
  const program = useQuery(api.referrals.programStatus)
  const paused = program ? !program.active : false

  if (!isSignedIn) {
    return (
      <main className="settings-page referrals-page">
        <header className="settings-page-header">
          <p className="text-meta">Referrals</p>
          <h1 className="text-h1">Invite friends</h1>
          <p className="text-body muted">
            {paused
              ? 'Referrals are paused right now. You can still explore the community.'
              : 'Sign in to get your referral link and start earning 5% of the booking subtotal, for life.'}
          </p>
        </header>
        {program === undefined ? (
          <div className="empty-state">Checking the referral program...</div>
        ) : paused ? (
          <ReferralsPausedNotice />
        ) : (
          <>
            <ReferralHero signedOut />
            <ReferralSteps />
            <ReferralFinePrint />
          </>
        )}
      </main>
    )
  }

  return (
    <main className="settings-page referrals-page">
      <Link to="/wallet" className="btn btn-ghost btn-sm referrals-back-link">
        <ChevronLeft size={16} aria-hidden="true" />
        <span>Wallet</span>
      </Link>
      <header className="settings-page-header">
        <p className="text-meta">Referrals</p>
        <h1 className="text-h1">Invite friends</h1>
        <p className="text-body muted">
          {paused
            ? 'Referral activity and existing credit. New referrals are paused right now.'
            : 'Earn 5% of the booking subtotal on every completed booking your friend makes, for life.'}
        </p>
      </header>
      <ReferralPanel showHeader={false} />
      {!paused && (
        <>
          <ReferralHero />
          <ReferralSteps />
          <ReferralFinePrint />
        </>
      )}
    </main>
  )
}
