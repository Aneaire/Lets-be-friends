import {
  formatPhp,
  referralShareUrl,
} from '@lets-be-friends/shared'
import { Button } from '../../design-system/atoms/Button'
import { InfiniteScrollTrigger } from '../../design-system/molecules/InfiniteScrollTrigger'
import { ReferralRow, type ReferralRowItem } from './ReferralRow'

export type ReferralPageStatus = 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'

export type ReferralPanelData = {
  code: string | null
  rewards: Array<{
    _id: string
    bookingId: string
    amountCentavos: number
    status: string
    createdAt: number
  }>
  totalReferrals: number
  totalRewardedBookings: number
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
  items,
  status,
  busy,
  error,
  notice,
  origin,
  showHeader = true,
  onCreateCode,
  onCopyLink,
  onLoadMore,
}: {
  referral: ReferralPanelData
  items: ReferralRowItem[]
  status: ReferralPageStatus
  busy: boolean
  error: string
  notice: string
  origin: string
  showHeader?: boolean
  onCreateCode: () => void
  onCopyLink: () => void
  onLoadMore: () => void
}) {
  const shareUrl = referral.code ? referralShareUrl(origin, referral.code) : ''

  return (
    <section
      id="referrals"
      className={showHeader ? 'mb-10' : undefined}
      aria-labelledby={showHeader ? 'referrals-title' : undefined}
      aria-label={showHeader ? undefined : 'Referral details'}
    >
      {showHeader ? (
        <header className="flex items-baseline justify-between gap-3 mb-3">
          <div>
            <h2 id="referrals-title" className="text-h2">Invite friends</h2>
            <p className="text-meta mt-1">Earn booking credit equal to 68% of our 15% service fee on each friend's first 3 completed bookings. Friends pay the normal price.</p>
            <p className="text-meta mt-1">Example: a ₱700 booking has a ₱105 service fee, and you earn ₱71.40 in credit.</p>
          </div>
        </header>
      ) : null}

      {error && <div className="notice notice-danger mb-3" role="alert"><span className="notice-icon">!</span><span>{error}</span></div>}
      {notice && <div className="notice mb-3" role="status"><span className="notice-icon">i</span><span>{notice}</span></div>}

      <div className="panel p-4 space-y-4 sm:p-5 sm:space-y-5">
        {!referral.code ? (
          <div className="space-y-3">
            <div>
              <p className="text-h3">Create your referral link</p>
              <p className="text-meta mt-1">Share one link. When a friend completes a booking, you earn booking credit.</p>
            </div>
            <Button type="button" intent="social" loading={busy} loadingLabel="Creating link..." onClick={onCreateCode}>
              Create my referral link
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-h3">Your referral link</p>
              <p className="text-meta mt-1">Share this link. Credit lands in your wallet after each booking settles.</p>
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
            <p className="text-h2 tabular mt-1">{referral.totalReferrals}</p>
          </div>
          <div className="wallet-metric">
            <p className="text-meta">Rewarded bookings</p>
            <p className="text-h2 tabular mt-1">{referral.totalRewardedBookings}</p>
          </div>
          <div className="wallet-metric wallet-metric-available">
            <p className="text-meta">Referral credit earned</p>
            <p className="text-h2 tabular mt-1">{formatPhp(referral.totalEarnedCentavos)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-h3">Your referrals</p>
          {status === 'LoadingFirstPage' ? (
            <p className="text-meta">Loading referrals...</p>
          ) : items.length > 0 ? (
            <ul className="space-y-2">
              {items.map((item) => <ReferralRow key={item._id} item={item} />)}
            </ul>
          ) : (
            <p className="text-meta">No friends have joined with your link yet.</p>
          )}
          <InfiniteScrollTrigger
            status={status}
            onLoadMore={onLoadMore}
            loadingLabel="Loading more referrals..."
          />
        </div>

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
