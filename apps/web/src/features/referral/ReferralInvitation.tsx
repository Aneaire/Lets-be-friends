import { Link } from '@tanstack/react-router'
import { useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { normalizeReferralCode, referralCodeValidationError, referralShareUrl } from '@lets-be-friends/shared'
import { api } from '../../../convex/_generated/api'
import { describeConvexError } from '../../lib/convexErrors'
import { SignInAction } from '../auth/SignInAction'
import { webReferralDeviceId } from './referralDevice'
import { clearSavedReferralCode } from './referralStorage'

export function ReferralInvitation({ code }: { code?: string }) {
  const { isSignedIn } = useAuth()
  const program = useQuery(api.referrals.programStatus)
  const referral = useQuery(api.referrals.myReferral, isSignedIn ? {} : 'skip')
  const paused = program ? !program.active : false
  const normalized = normalizeReferralCode(code ?? '')
  const valid = !referralCodeValidationError(normalized)
  const alreadyJoined = Boolean(referral?.referredBy)
  const isOwnCode = Boolean(valid && referral?.code === normalized)

  return (
    <main className="referral-invitation">
      <section className="referral-invitation-hero" aria-labelledby="invitation-title">
        <div className="referral-invitation-copy">
          <p className="eyebrow">{isOwnCode ? 'Your invitation' : 'A little invitation for you'}</p>
          <h1 id="invitation-title" className="text-display">{isOwnCode ? 'Good company starts with you.' : 'Good company starts here.'}</h1>
          <p className="lede">{isOwnCode
            ? 'Share this page with a friend. When they join with your code, you earn 5% of the booking subtotal on every completed booking, for life.'
            : 'A friend invited you to Let’s Be Friends. Find everyday help, share an activity, and make room for a new connection.'}</p>
          <div className="referral-invitation-code">
            {valid ? (
              <><span>YOUR INVITATION CODE</span><strong>{normalized}</strong><p>{paused ? 'Referrals are paused right now. This code cannot be added.' : isOwnCode ? 'This is your own code. Share it with a friend so they can join.' : alreadyJoined ? 'Your invitation is already applied to this account.' : 'Keep this code handy when you join.'}</p></>
            ) : (
              <><span>INVITATION CODE</span><p>This invitation code is missing or invalid. You can still explore and join.</p></>
            )}
          </div>
          {paused && !isSignedIn && (
            <div className="notice notice-danger mt-4" role="status">
              <span className="notice-icon">!</span>
              <span>Referrals are paused right now. You can still join the community, but this code cannot be added until the program reopens.</span>
            </div>
          )}
          {isSignedIn && valid && !isOwnCode && <ReferralClaim code={normalized} />}
          <div className="referral-invitation-actions">
            {isSignedIn
              ? (isOwnCode
                  ? (
                    <>
                      <Link to="/referrals" className="btn btn-self btn-lg">Go to your referrals</Link>
                      <CopyInviteLink code={normalized} />
                    </>
                  )
                  : <Link to="/social" className="btn btn-social btn-lg">Go to the community</Link>)
              : <SignInAction className="btn btn-self btn-lg">Join or sign in</SignInAction>}
            <Link to="/safety" className="btn btn-ghost">How safety works</Link>
          </div>
        </div>
        <figure className="referral-invitation-image">
          <img
            src="/images/marketing/referral-welcome-friends.webp"
            srcSet="/images/marketing/referral-welcome-friends-768.webp 768w, /images/marketing/referral-welcome-friends.webp 1122w"
            sizes="(max-width: 900px) 100vw, 38rem"
            alt="Friends welcoming someone new at a sunny neighborhood table"
            width={1122}
            height={1402}
          />
          <figcaption>Make a plan. Share the moment.</figcaption>
        </figure>
      </section>
      <section className="referral-invitation-details" aria-labelledby="invitation-next-title">
        <div>
          <p className="eyebrow">A welcoming place to start</p>
          <h2 id="invitation-next-title" className="text-h1">A little easier together.</h2>
          <p className="text-body muted mt-3 max-w-[42ch]">
            {isOwnCode
              ? 'You earn 5% of the booking subtotal on every completed booking your friend makes. They pay the normal price.'
              : 'Your friend earns 5% of the booking subtotal on every completed booking. You pay the normal price.'}
          </p>
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

function CopyInviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function copy() {
    setError('')
    try {
      await navigator.clipboard.writeText(referralShareUrl(window.location.origin, code))
      setCopied(true)
    } catch {
      setError('The link could not be copied.')
    }
  }

  return (
    <>
      <button type="button" className="btn btn-neutral btn-lg" onClick={() => void copy()}>
        {copied ? 'Copied' : 'Copy invite link'}
      </button>
      {error && <span className="text-meta text-[color:var(--danger)]" role="alert">{error}</span>}
    </>
  )
}

function ReferralClaim({ code }: { code: string }) {
  const referral = useQuery(api.referrals.myReferral, {})
  const attributeReferral = useMutation(api.referrals.attributeReferral)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (referral?.referredBy) clearSavedReferralCode()
  }, [referral?.referredBy])

  if (referral === undefined) {
    return <p className="text-meta mt-4">Checking your referral status...</p>
  }
  if (referral === null) return null
  if (!referral.programActive) {
    return <div className="notice notice-danger mt-4" role="status"><span className="notice-icon">!</span><span>Referrals are paused right now.</span></div>
  }
  if (referral.code === code) {
    return (
      <div className="notice mt-4" role="status">
        <span className="notice-icon">i</span>
        <span>This is your own referral code. Share it with a friend instead.</span>
      </div>
    )
  }
  if (referral.referredBy) {
    return (
      <div className="notice mt-4" role="status">
        <span className="notice-icon">i</span>
        <span>You are already joined with {referral.referredBy.referrerDisplayName}&apos;s code.</span>
      </div>
    )
  }
  if (!referral.canAddReferralCode) {
    return (
      <div className="notice mt-4" role="status">
        <span className="notice-icon">i</span>
        <span>Referral codes can only be added within 30 days of joining and before your first booking.</span>
      </div>
    )
  }

  async function claim() {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await attributeReferral({ code, deviceId: webReferralDeviceId() })
      clearSavedReferralCode()
      setMessage('Referral code added. Your friend earns 5% of the booking subtotal on every completed booking, for life.')
    } catch (claimError) {
      setError(claimError instanceof Error ? describeConvexError(claimError) : 'We could not add this code. Check it and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-4">
      <p className="text-h3">Add your friend&apos;s code</p>
      <p className="text-meta mt-1">Add this code to credit your friend. It can be added within 30 days of joining and before your first booking.</p>
      {message && <div className="notice mt-3" role="status"><span className="notice-icon">i</span><span>{message}</span></div>}
      {error && <div className="notice notice-danger mt-3" role="alert"><span className="notice-icon">!</span><span>{error}</span></div>}
      <button type="button" className="btn btn-social mt-3" disabled={busy || Boolean(message)} onClick={() => void claim()}>
        {busy ? 'Adding code...' : message ? 'Code added' : 'Add this code to my account'}
      </button>
    </div>
  )
}
