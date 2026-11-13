import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { formatPhp, referralRewardLabel } from '@lets-be-friends/shared'
import { api } from '../../../convex/_generated/api'

export function ReferralEarningsCard() {
  const referral = useQuery(api.referrals.myReferral)

  if (referral === undefined) {
    return (
      <section className="panel p-5 mb-10">
        <p className="text-h3">Referral earnings</p>
        <p className="text-meta mt-1">Loading referral credit...</p>
      </section>
    )
  }
  if (referral === null) return null

  const recent = referral.recentRewards
  return (
    <section className="panel p-5 mb-10" aria-labelledby="referral-earnings-title">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-h3" id="referral-earnings-title">{referral.programActive ? 'Invite friends' : 'Referral earnings'}</p>
          <p className="text-meta mt-1">
            {referral.programActive
              ? 'Earn 5% of the booking subtotal on every completed booking your friend makes, for life. Credit releases after the 14-day hold.'
              : 'Referrals are paused right now. Existing credit still settles and releases.'}
          </p>
        </div>
        <Link to="/referrals" className="btn btn-social btn-sm">View referrals</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mt-4">
        <div className="wallet-metric">
          <p className="text-meta">Friends joined</p>
          <p className="text-h2 tabular mt-1">{referral.totalReferrals}</p>
        </div>
        <div className="wallet-metric wallet-metric-available">
          <p className="text-meta">Referral credit earned</p>
          <p className="text-h2 tabular mt-1">{formatPhp(referral.totalEarnedCentavos)}</p>
        </div>
        <div className="wallet-metric">
          <p className="text-meta">Pending release</p>
          <p className="text-h2 tabular mt-1">{formatPhp(referral.totalPendingCentavos)}</p>
        </div>
      </div>

      {referral.referralDebtCentavos > 0 && (
        <p className="text-meta mt-3">{formatPhp(referral.referralDebtCentavos)} referral debt will be offset against future credit.</p>
      )}

      {recent.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {recent.map((reward) => (
            <li key={reward._id} className="flex items-center justify-between gap-3 border-t border-[color:var(--rule)] pt-2 first:border-t-0 first:pt-0">
              <div>
                <p className="text-body">{referralRewardLabel(reward.kind as 'lifetime' | 'launch_bonus' | undefined, reward.rewardBps)}</p>
                <p className="text-meta">{new Date(reward.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="text-body tabular">{formatPhp(reward.amountCentavos)}</p>
                <span className="status-pill" data-tone={reward.status === 'credited' ? 'success' : reward.status === 'pending' ? 'warning' : 'danger'}>
                  {reward.status === 'credited' ? 'available' : reward.status === 'pending' ? reward.reviewRequired ? 'under review' : 'pending' : 'reversed'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-meta mt-4">No referral earnings yet.</p>
      )}
    </section>
  )
}
