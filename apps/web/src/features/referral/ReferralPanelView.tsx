import type { ReactNode } from 'react'
import {
  formatPhp,
  referralRewardLabel,
  referralShareUrl,
} from '@lets-be-friends/shared'
import { Check } from 'lucide-react'
import { Button } from '../../design-system/atoms/Button'
import { InfiniteScrollTrigger } from '../../design-system/molecules/InfiniteScrollTrigger'
import { ReferralRow, type ReferralRowItem } from './ReferralRow'

export type ReferralPageStatus = 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'

export type ReferralRewardItem = {
  _id: string
  bookingId: string
  kind: string
  amountCentavos: number
  rewardBps: number | null
  status: string
  reviewRequired: boolean
  createdAt: number
  releasedAt: number | null
  referredDisplayName: string
}

export type ReferralPanelData = {
  code: string | null
  programActive: boolean
  totalReferrals: number
  totalRewardedBookings: number
  totalEarnedCentavos: number
  totalPendingCentavos: number
  referralCreditAvailableCentavos?: number
  totalReversedCentavos: number
  referralDebtCentavos: number
  canAddReferralCode: boolean
  referredBy: {
    referrerDisplayName: string
    code: string
    rewardedBookings: number
    termsVersion: string | null
  } | null
}

export function ReferralPanelView({
  referral,
  items,
  status,
  rewardItems,
  rewardStatus,
  busy,
  error,
  notice,
  origin,
  copied = false,
  showHeader = true,
  friendCodeCard,
  onCreateCode,
  onCopyLink,
  onLoadMore,
  onLoadMoreRewards,
}: {
  referral: ReferralPanelData
  items: ReferralRowItem[]
  status: ReferralPageStatus
  rewardItems: ReferralRewardItem[]
  rewardStatus: ReferralPageStatus
  busy: boolean
  error: string
  notice: string
  origin: string
  copied?: boolean
  showHeader?: boolean
  friendCodeCard?: ReactNode
  onCreateCode: () => void
  onCopyLink: () => void
  onLoadMore: () => void
  onLoadMoreRewards: () => void
}) {
  const shareUrl = referral.code ? referralShareUrl(origin, referral.code) : ''
  const heldRewards = rewardItems.filter((reward) => reward.status === 'pending' && reward.reviewRequired)
  const hasHeldRewards = heldRewards.length > 0

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
            <p className="text-meta mt-1">Earn booking credit equal to 5% of the booking subtotal on every completed booking your friend makes, for life. Friends pay the normal price.</p>
            <p className="text-meta mt-1">Example: a ₱700 booking subtotal earns ₱35 in credit. The member also pays the 15% service fee, and the credit comes from that fee.</p>
          </div>
        </header>
      ) : null}

      {!referral.programActive && (
        <div className="notice notice-danger mb-3" role="status">
          <span className="notice-icon">!</span>
          <span>Referrals are paused right now. Existing referral credit still settles and releases.</span>
        </div>
      )}

      {error && <div className="notice notice-danger mb-3" role="alert"><span className="notice-icon">!</span><span>{error}</span></div>}
      {notice && <div className="notice mb-3" role="status"><span className="notice-icon">i</span><span>{notice}</span></div>}

      <div className="panel p-4 space-y-4 sm:p-5 sm:space-y-5">
        {!referral.code ? (
          <div className="space-y-3">
            <div>
              <p className="text-h3">Create your referral link</p>
              <p className="text-meta mt-1">Share one link. When a friend completes a booking, you earn 5% of the booking subtotal, for life.</p>
            </div>
            <Button type="button" intent="social" loading={busy} loadingLabel="Creating link..." onClick={onCreateCode}>
              Create my referral link
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-h3">Your referral link</p>
              <p className="text-meta mt-1">Share this link. Credit lands in your wallet after each booking settles and the 14-day hold clears.</p>
              <p className="text-meta mt-1">A friend counts here after they add your code, not just after they open the link.</p>
              <p className="text-meta mt-1">Your friend must add your code within 30 days of joining and before their first booking.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="field flex-1" readOnly value={shareUrl} aria-label="Your referral link" onFocus={(event) => event.currentTarget.select()} />
              <Button type="button" intent="social" className="referral-copy-button" onClick={onCopyLink}>
                <span className="referral-copy-label">
                  <span className="referral-copy-label-text" data-visible={!copied} aria-hidden={copied}>Copy link</span>
                  <span className="referral-copy-label-text referral-copy-label-success" data-visible={copied} aria-hidden={!copied}>
                    <span key={copied ? 'copied' : 'idle'} className="referral-copy-check" aria-hidden="true">
                      <Check size={16} strokeWidth={2.5} />
                    </span>
                    Copied
                  </span>
                </span>
              </Button>
            </div>
            <p className="text-meta">Your code: <strong>{referral.code}</strong></p>
          </div>
        )}

        {friendCodeCard ? <div className="pt-1">{friendCodeCard}</div> : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="wallet-metric">
            <p className="text-meta">Friends joined</p>
            <p className="text-h2 tabular mt-1">{referral.totalReferrals}</p>
          </div>
          <div className="wallet-metric">
            <p className="text-meta">Rewarded bookings</p>
            <p className="text-h2 tabular mt-1">{referral.totalRewardedBookings}</p>
          </div>
          <div className={`wallet-metric ${referralAvailableCentavos(referral) > 0 ? 'wallet-metric-available' : ''}`}>
            <p className="text-meta">Referral credit available</p>
            <p className="text-h2 tabular mt-1">{formatPhp(referralAvailableCentavos(referral))}</p>
            {referral.totalPendingCentavos > 0 && (
              <p className="text-meta mt-1">
                {formatPhp(referral.totalPendingCentavos)} {hasHeldRewards ? 'pending release or under review' : 'pending release'}
              </p>
            )}
            {hasHeldRewards && <p className="text-tiny mt-1">Held credit waits for a review. Other credit releases after the 14-day hold.</p>}
            <p className="text-meta mt-1">Lifetime credited {formatPhp(referral.totalEarnedCentavos)}</p>
            {referral.referralDebtCentavos > 0 && (
              <p className="text-meta mt-1">{formatPhp(referral.referralDebtCentavos)} referral debt will be offset against future credit</p>
            )}
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
            <p className="text-meta">No friends have added your code yet.</p>
          )}
          <InfiniteScrollTrigger
            status={status}
            onLoadMore={onLoadMore}
            loadingLabel="Loading more referrals..."
          />
        </div>

        <div className="space-y-2">
          <p className="text-h3">Referral earnings</p>
          {rewardStatus === 'LoadingFirstPage' ? (
            <p className="text-meta">Loading referral earnings...</p>
          ) : rewardItems.length > 0 ? (
            <ul className="space-y-2">
              {rewardItems.map((reward) => <ReferralRewardRow key={reward._id} reward={reward} />)}
            </ul>
          ) : (
            <p className="text-meta">No referral earnings yet. Credit appears after a friend&apos;s booking settles.</p>
          )}
          <InfiniteScrollTrigger
            status={rewardStatus}
            onLoadMore={onLoadMoreRewards}
            loadingLabel="Loading more referral earnings..."
          />
        </div>

        {referral.referredBy && (
          <div className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-4">
            <p className="text-h3">You joined with {referral.referredBy.referrerDisplayName}&apos;s code</p>
            <p className="text-meta mt-1">{referral.referredBy.referrerDisplayName} earns 5% of the booking subtotal on every booking you complete. You pay the normal price.</p>
            {referral.referredBy.rewardedBookings > 0 && (
              <p className="text-meta mt-1">{referral.referredBy.rewardedBookings} {referral.referredBy.rewardedBookings === 1 ? 'booking has' : 'bookings have'} earned them credit so far.</p>
            )}
          </div>
        )}
      </div>

      <p className="text-meta mt-4">
        Referral credit is added to your wallet after each booking settles and clears a 14-day hold. It is reversed if an admin reverses the credit or confirms fraud. The 5% rate applies to the booking subtotal, not the member total including the service fee. Read the <a href="/referral-terms" className="underline">referral terms</a>.
      </p>
    </section>
  )
}

function referralAvailableCentavos(referral: ReferralPanelData) {
  return referral.referralCreditAvailableCentavos ?? referral.totalEarnedCentavos
}

function formatRewardDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function ReferralRewardRow({ reward }: { reward: ReferralRewardItem }) {
  const status = reward.status === 'credited'
    ? 'Available'
    : reward.status === 'pending'
      ? reward.reviewRequired ? 'Under review' : 'Pending release'
      : 'Reversed'
  const tone = reward.status === 'credited' ? 'success' : reward.status === 'pending' ? 'warning' : 'danger'
  return (
    <li className="flex items-start justify-between gap-3 border-t border-[color:var(--rule)] pt-2 first:border-t-0 first:pt-0">
      <div>
        <p className="text-body">{reward.referredDisplayName}</p>
        <p className="text-meta">
          {referralRewardLabel(reward.kind as 'lifetime' | 'launch_bonus' | undefined, reward.rewardBps)} · {formatRewardDate(reward.createdAt)}
        </p>
        <p className="text-tiny mt-0.5">Booking {reward.bookingId.slice(-6).toUpperCase()}</p>
      </div>
      <div className="text-right">
        <p className="text-body tabular">
          {reward.status === 'reversed' ? `−${formatPhp(reward.amountCentavos)}` : formatPhp(reward.amountCentavos)}
        </p>
        <span className="status-pill" data-tone={tone}>{status}</span>
        {reward.reviewRequired && (
          <p className="text-meta mt-1 max-w-[18rem]">
            Held for a referral check. <a href="/referral-terms#reviews" className="whitespace-nowrap underline">Why is this held?</a>
          </p>
        )}
      </div>
    </li>
  )
}
