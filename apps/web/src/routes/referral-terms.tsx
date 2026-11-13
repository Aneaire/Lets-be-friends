import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/referral-terms')({ component: ReferralTermsPage })

function ReferralTermsPage() {
  return (
    <main className="settings-page">
      <Link to="/referrals" className="btn btn-ghost btn-sm mb-6">Back to referrals</Link>
      <header className="settings-page-header">
        <p className="text-meta">Referrals</p>
        <h1 className="text-h1">Referral terms</h1>
        <p className="text-body muted">The rules for earning and using referral credit.</p>
      </header>

      <section className="panel p-5 space-y-4">
        <article>
          <h2 className="text-h2">Who can earn</h2>
          <p className="text-body muted mt-2">A member with an active account can create a referral code and share it with an adult who is new to {`Let's Be Friends`}. You cannot use your own code, and a member can be linked to only one referrer. A code can be added within 30 days of the invited member joining and before their first booking.</p>
        </article>

        <article>
          <h2 className="text-h2">What you earn</h2>
          <p className="text-body muted mt-2">You earn 5% of the booking subtotal on every completed booking made by a friend who joined with your code. The member also pays a 15% platform service fee on the subtotal, and the referral credit comes from that fee. For example, a ₱700 booking subtotal has a ₱105 service fee. The referrer earns ₱35, and the platform keeps ₱70 of that fee. The 5% rate applies for the life of the referral, with no cap on the number of bookings or the credit earned.</p>
        </article>

        <article>
          <h2 className="text-h2">Legacy referrals</h2>
          <p className="text-body muted mt-2">Referrals created before the 5% lifetime terms use the earlier rate: 68% of the platform fee for the first three rewarded bookings, then 5% of the booking subtotal for life. The 68% rate is not 68% of the booking subtotal.</p>
        </article>

        <article>
          <h2 className="text-h2">When credit is available</h2>
          <p className="text-body muted mt-2">Referral credit is recorded after the booking settles. It is held for 14 days before it becomes available in your wallet. The hold gives the platform time to handle a refund, dispute, or fraud check. If an admin reverses the credit or we confirm fraud, the related referral credit is reversed. If the credit was already spent or withdrawn, the shortfall becomes a referral debt that is offset against future referral credit.</p>
        </article>

        <article id="reviews">
          <h2 className="text-h2">Reviews and fraud</h2>
          <p className="text-body muted mt-2">We may hold a referral credit while we review a shared device, a high volume of referrals, a related-party booking, or a Companion referring their own client. We may reverse credit obtained through a duplicate account, a misleading invitation, a fake booking, or another attempt to manipulate the program.</p>
        </article>

        <article>
          <h2 className="text-h2">Taxes</h2>
          <p className="text-body muted mt-2">You are responsible for any tax that applies to referral credit you receive. We may ask for information required by law before releasing a reward.</p>
        </article>

        <article>
          <h2 className="text-h2">Changes</h2>
          <p className="text-body muted mt-2">We may pause new referrals, change the program, or update these terms. A referral that was already attributed keeps the terms recorded when it was created. We will show a notice in the app when the program is paused or a material term changes.</p>
        </article>
      </section>
    </main>
  )
}
