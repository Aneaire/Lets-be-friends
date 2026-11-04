import {
  formatPhp,
  referralShareUrl,
} from '@lets-be-friends/shared'
import { Button } from '../../design-system/atoms/Button'

export type ReferralPanelData = {
  code: string | null
  referrals: Array<{
    _id: string
    referredDisplayName: string
    status: string
    rewardedBookings: number
    totalRewardedBookings: number
    createdAt: number
  }>
  rewards: Array<{
    _id: string
    bookingId: string
    amountCentavos: number
    status: string
    createdAt: number
  }>
  totalEarnedCentavos: number
  totalReversedCentavos: number
  referredBy: {
    referrerDisplayName: string
    code: string
    rewardedBookings: number
    totalRewardedBookings: number
  } | null
}

export function ReferralPanelView({
  referral,
  busy,
  error,
  notice,
  origin,
  onCreateCode,
  onCopyLink,
}: {
  referral: ReferralPanelData
  busy: boolean
  error: string
  notice: string
  origin: string
  onCreateCode: () => void
  onCopyLink: () => void
}) {
  const shareUrl = referral.code ? referralShareUrl(origin, referral.code) : ''
  const rewardedBookings = referral.referrals.reduce((total, item) => total + item.rewardedBookings, 0)

  return (
    <section id="referrals" className="mb-10" aria-labelledby="referrals-title">
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 id="referrals-title" className="text-h2">Invite friends</h2>
          <p className="text-meta mt-1">Earn 68% of our service fee on each friend's first 3 completed bookings.</p>
        </div>
        {referral.totalEarnedCentavos > 0 && (
          <span className="status-pill" data-tone="success">{formatPhp(referral.totalEarnedCentavos)} earned</span>
        )}
      </header>

      {error && <div className="notice notice-danger mb-3" role="alert"><span className="notice-icon">!</span><span>{error}</span></div>}
      {notice && <div className="notice mb-3" role="status"><span className="notice-icon">i</span><span>{notice}</span></div>}

      <div className="panel p-5 space-y-5">
        {!referral.code ? (
          <div className="space-y-3">
            <div>
              <p className="text-h3">Create your referral link</p>
              <p className="text-meta mt-1">Share one link. When a friend completes a booking, you earn 68% of our service fee as booking credit.</p>
            </div>
            <Button type="button" intent="social" loading={busy} loadingLabel="Creating link..." onClick={onCreateCode}>
              Create my referral link
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-h3">Your referral link</p>
              <p className="text-meta mt-1">Friends pay the normal price. You earn 68% of our service fee on each of their first 3 completed bookings.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="field flex-1" readOnly value={shareUrl} aria-label="Your referral link" onFocus={(event) => event.currentTarget.select()} />
              <Button type="button" intent="social" onClick={onCopyLink}>Copy link</Button>
            </div>
            <p className="text-meta">Your code: <strong>{referral.code}</strong></p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="wallet-metric">
            <p className="text-meta">Friends joined</p>
            <p className="text-h2 tabular mt-1">{referral.referrals.length}</p>
          </div>
          <div className="wallet-metric">
            <p className="text-meta">Rewarded bookings</p>
            <p className="text-h2 tabular mt-1">{rewardedBookings}</p>
          </div>
          <div className="wallet-metric wallet-metric-available">
            <p className="text-meta">Referral credit earned</p>
            <p className="text-h2 tabular mt-1">{formatPhp(referral.totalEarnedCentavos)}</p>
          </div>
        </div>

        {referral.referrals.length > 0 && (
          <div className="space-y-2">
            <p className="text-h3">Your referrals</p>
            <ul className="space-y-2">
              {referral.referrals.map((item) => (
                <li key={item._id} className="flex items-center justify-between gap-3 border-t border-[color:var(--rule)] pt-2 first:border-t-0 first:pt-0">
                  <div>
                    <p className="text-body">{item.referredDisplayName}</p>
                    <p className="text-meta">{item.rewardedBookings} of {item.totalRewardedBookings} bookings rewarded</p>
                  </div>
                  <span className="status-pill" data-tone={item.status === 'completed' ? 'success' : 'social'}>
                    {item.status === 'completed' ? 'complete' : item.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {referral.referredBy && (
          <div className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-4">
            <p className="text-h3">You joined with {referral.referredBy.referrerDisplayName}'s code</p>
            <p className="text-meta mt-1">{referral.referredBy.rewardedBookings} of {referral.referredBy.totalRewardedBookings} rewarded bookings on your account.</p>
          </div>
        )}
      </div>
    </section>
  )
}
