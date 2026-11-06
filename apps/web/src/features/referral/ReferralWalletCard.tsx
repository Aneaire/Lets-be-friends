import { Link } from '@tanstack/react-router'

export function ReferralWalletCard() {
  return (
    <section className="panel p-5 mb-10">
      <p className="text-h3">Invite friends</p>
      <p className="text-meta mt-1">Earn booking credit when friends complete their first 3 bookings.</p>
      <Link to="/referrals" className="btn btn-social btn-sm mt-4">View referrals</Link>
    </section>
  )
}
