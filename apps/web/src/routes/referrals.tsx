import { SignInButton, useAuth } from '@clerk/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'

import { ReferralPanel } from '../features/referral/ReferralPanel'

export const Route = createFileRoute('/referrals')({ component: ReferralsPage })

function ReferralsPage() {
  const { isSignedIn } = useAuth()

  if (!isSignedIn) {
    return (
      <main className="settings-page referrals-page">
        <header className="settings-page-header">
          <p className="text-meta">Referrals</p>
          <h1 className="text-h1">Invite friends</h1>
          <p className="text-body muted">Sign in to see your referral link and activity.</p>
        </header>
        <SignInButton mode="modal">
          <button className="btn btn-self">Sign in</button>
        </SignInButton>
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
        <p className="text-body muted">Earn booking credit when friends complete their first 3 bookings.</p>
      </header>
      <ReferralPanel showHeader={false} />
      <p className="text-meta mt-4">
        You earn 68% of our 15% service fee on each friend's first 3 completed bookings. Example: a ₱700 booking earns ₱71.40.
      </p>
    </main>
  )
}
