import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { formatPhp, referralRewardLabel } from '@lets-be-friends/shared'
import { api } from '../../../web/convex/_generated/api'

export const Route = createFileRoute('/referrals')({ component: AdminReferralsPage })

function AdminReferralsPage() {
  const overview = useQuery(api.admin.referralOverview)
  const setProgram = useMutation(api.admin.setReferralProgramActive)
  const resolveSignal = useMutation(api.admin.resolveReferralFraudSignal)
  const clearReview = useMutation(api.admin.clearReferralRewardReview)
  const reverseReferral = useMutation(api.admin.reverseReferralForBooking)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (overview === undefined) {
    return <div className="admin-empty">Loading referral program...</div>
  }

  const program = overview.program

  async function run(key: string, action: () => Promise<unknown>, success: string) {
    if (busy) return
    setBusy(key)
    setMessage('')
    setError('')
    try {
      await action()
      setMessage(success)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The referral action could not be completed.')
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Growth</p>
          <h1 className="text-h1 mt-2">Referrals</h1>
          <p className="lede mt-2">Control the referral program, review fraud signals, and see recent referral activity.</p>
        </div>
      </header>

      {message && <div className="notice notice-success mb-4" role="status"><span className="notice-icon">✓</span><span>{message}</span></div>}
      {error && <div className="notice notice-danger mb-4" role="alert"><span className="notice-icon">!</span><span>{error}</span></div>}



      <section id="open-fraud-signals" className="panel mb-6">
        <div className="panel-header">
          <h2 className="text-h2">Open fraud signals</h2>
          <span className="text-meta tabular">{overview.openSignals.length}</span>
        </div>
        <div className="panel-body">
          {overview.openSignals.length === 0 ? (
            <p className="text-meta">No open referral signals.</p>
          ) : (
            <div className="worklist">
              {overview.openSignals.map((signal) => {
                const selfReview = signal.referrerUserId === overview.viewerUserId
                return (
                  <article key={signal._id} className="worklist-row">
                    <div className="worklist-row-head">
                      <div>
                        <h3 className="text-h3">{signal.referrerDisplayName}</h3>
                        <div className="worklist-row-meta">
                          <span>Friend: {signal.referredDisplayName}</span>
                          <span className="dot" aria-hidden="true" />
                          <span>{signalLabel(signal.signal)}</span>
                          <span className="dot" aria-hidden="true" />
                          <span>{formatAdminDate(signal.createdAt)}</span>
                        </div>
                        {signal.note && <p className="text-meta mt-1">{signal.note}</p>}
                        {signal.bookingId && (
                          <>
                            <p className="text-meta mt-1">
                              Latest rewarded booking {signal.bookingId.slice(-6).toUpperCase()}
                              {signal.bookingRequestedAt ? ` · ${formatAdminDate(signal.bookingRequestedAt)}` : ''}
                              {signal.bookingSubtotalCentavos !== null ? ` · Subtotal ${formatPhp(signal.bookingSubtotalCentavos)}` : ''}
                              {signal.bookingMemberTotalCentavos !== null ? ` · Member total ${formatPhp(signal.bookingMemberTotalCentavos)}` : ''}
                            </p>
                            <p className="text-meta mt-1">
                              {signal.rewardsAtRisk} {signal.rewardsAtRisk === 1 ? 'reward' : 'rewards'} at risk · {formatPhp(signal.rewardAtRiskCentavos)}
                            </p>
                          </>
                        )}
                        {selfReview && (
                          <p className="text-meta mt-1 text-[color:var(--danger)]">
                            You are the referrer on this referral. Another full admin must resolve it.
                          </p>
                        )}
                      </div>
                      {selfReview ? (
                        <span className="text-meta">Second admin required</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <ConfirmAction
                            label="Mark legitimate"
                            title="Clear this signal and release any held rewards for this referral?"
                            confirmLabel="Mark legitimate"
                            busy={busy === signal._id}
                            onConfirm={() => void run(signal._id, async () => {
                              const result = await resolveSignal({ signalId: signal._id, decision: 'legitimate' })
                              if (result.blockedByOpenSignals) throw new Error('Other open signals still hold this reward. Resolve them first.')
                            }, 'Signal approved. Held rewards will release.')}
                          />
                          <DangerConfirm
                            label="Mark fraud"
                            title="Mark this referral as fraud? This reverses every reward and blocks future credit for the referral."
                            confirmLabel="Confirm fraud"
                            busy={busy === signal._id}
                            onConfirm={(reason) => void run(signal._id, () => resolveSignal({ signalId: signal._id, decision: 'fraud', note: reason }), 'Signal marked as fraud. Rewards reversed.')}
                          />
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="panel mb-6">
        <div className="panel-header">
          <h2 className="text-h2">Held rewards</h2>
          <span className="text-meta tabular">{overview.heldRewards.length}</span>
        </div>
        <div className="panel-body">
          {overview.heldRewards.length === 0 ? (
            <p className="text-meta">No rewards are held for review.</p>
          ) : (
            <div className="worklist">
              {overview.heldRewards.map((reward) => {
                const selfReward = reward.referrerUserId === overview.viewerUserId
                return (
                <article key={reward._id} className="worklist-row">
                  <div className="worklist-row-head">
                    <div>
                      <h3 className="text-h3">{reward.referrerDisplayName}</h3>
                      <div className="worklist-row-meta">
                        <span>Friend: {reward.referredDisplayName}</span>
                        <span className="dot" aria-hidden="true" />
                        <span>Booking {reward.bookingId.slice(-6).toUpperCase()}</span>
                        <span className="dot" aria-hidden="true" />
                        <span>{referralRewardLabel(reward.kind as 'lifetime' | 'launch_bonus' | undefined, reward.rewardBps, 'short')}</span>
                        <span className="dot" aria-hidden="true" />
                        <span>{formatPhp(reward.amountCentavos)}</span>
                      </div>
                      {reward.releaseEligibleAt && (
                        <p className="text-meta mt-1">Hold ends {formatAdminDate(reward.releaseEligibleAt)}.</p>
                      )}
                      {reward.holdSignal && (
                        <p className="text-meta mt-1">
                          Held by open signal: {signalLabel(reward.holdSignal)}.{' '}
                          <a href="#open-fraud-signals" className="underline">Resolve it under Open fraud signals</a>.
                        </p>
                      )}
                    </div>
                    {selfReward ? (
                      <span className="text-meta">Second admin required</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {reward.holdSignal ? (
                          <span className="text-meta">Resolve the open signal first</span>
                        ) : (
                          <ConfirmAction
                            label={`Release ${formatPhp(reward.amountCentavos)}`}
                            title={`Release ${formatPhp(reward.amountCentavos)} to ${reward.referrerDisplayName} for booking ${reward.bookingId.slice(-6).toUpperCase()}?`}
                            confirmLabel="Release reward"
                            busy={busy === reward._id}
                            onConfirm={() => void run(reward._id, () => clearReview({ rewardId: reward._id }), 'Review cleared. The reward will release.')}
                          />
                        )}
                        <DangerConfirm
                          label="Reverse"
                          title={`Reverse every referral reward for booking ${reward.bookingId.slice(-6).toUpperCase()}?`}
                          confirmLabel="Confirm reverse"
                          busy={busy === reward._id}
                          onConfirm={(reason) => void run(reward._id, () => reverseReferral({ bookingId: reward.bookingId, reason }), 'Reward reversed.')}
                        />
                      </div>
                    )}
                  </div>
                </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <div className="admin-stat-grid mb-6">
        <Stat label="Total referrals" value={String(overview.totals.totalReferrals)} />
        <Stat label="Credit released" value={formatPhp(overview.totals.creditedCentavos)} />
        <Stat label="Credit pending" value={formatPhp(overview.totals.pendingCentavos)} />
        <Stat label="Open signals" value={String(overview.totals.openSignals)} />
      </div>

      <section className="panel mb-6">
        <div className="panel-header">
          <div>
            <h2 className="text-h2">Program controls</h2>
            <p className="text-meta mt-1">Pausing stops new codes and attributions. Existing referral credit still settles and releases.</p>
            <p className="text-meta mt-1">Current program: 5% of the booking subtotal, lifetime. 14-day hold. No launch bonus.</p>
            <p className="text-meta mt-1">On a ₱700 booking subtotal, the referrer earns ₱35. The member pays a 15% service fee of ₱105, for a ₱805 total.</p>
          </div>
          <span className="status-pill" data-tone={program.active ? 'success' : 'danger'}>
            {program.active ? 'Active' : 'Paused'}
          </span>
        </div>
        <div className="panel-body space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={program.active ? 'btn btn-danger' : 'btn btn-neutral'}
              disabled={busy === 'program'}
              onClick={() => void run('program', () => setProgram({ active: !program.active }), program.active ? 'Referrals paused.' : 'Referrals resumed.')}
            >
              {program.active ? 'Pause referrals' : 'Resume referrals'}
            </button>
          </div>
        </div>
      </section>

      <section className="panel mb-6">
        <div className="panel-header">
          <h2 className="text-h2">Recent referral rewards</h2>
          <span className="text-meta tabular">{overview.recentRewards.length}</span>
        </div>
        <div className="panel-body">
          {overview.recentRewards.length === 0 ? (
            <p className="text-meta">No referral rewards yet.</p>
          ) : (
            <div className="worklist">
              {overview.recentRewards.map((reward) => {
                const selfReward = reward.referrerUserId === overview.viewerUserId
                return (
                <article key={reward._id} className="worklist-row">
                  <div className="worklist-row-head">
                    <div>
                      <h3 className="text-h3">{reward.referrerDisplayName}</h3>
                      <div className="worklist-row-meta">
                        <span>{referralRewardLabel(reward.kind as 'lifetime' | 'launch_bonus' | undefined, reward.rewardBps, 'short')}</span>
                        <span className="dot" aria-hidden="true" />
                        <span>{formatPhp(reward.amountCentavos)}</span>
                        <span className="dot" aria-hidden="true" />
                        <span>Friend: {reward.referredDisplayName}</span>
                        <span className="dot" aria-hidden="true" />
                        <span>Booking {reward.bookingId.slice(-6).toUpperCase()}</span>
                        <span className="dot" aria-hidden="true" />
                        <span>{formatAdminDate(reward.createdAt)}</span>
                      </div>
                      {reward.reviewRequired && <p className="text-meta mt-1">Held for review.</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="status-pill" data-tone={reward.status === 'credited' ? 'success' : reward.status === 'pending' ? 'warning' : 'danger'}>{rewardStatusLabel(reward.status)}</span>
                      {selfReward ? (
                        <span className="text-meta">Second admin required</span>
                      ) : (
                        <>
                          {reward.reviewRequired && (
                            <ConfirmAction
                              label="Clear review"
                              title={`Release ${formatPhp(reward.amountCentavos)} to ${reward.referrerDisplayName} for booking ${reward.bookingId.slice(-6).toUpperCase()}?`}
                              confirmLabel="Release reward"
                              busy={busy === reward._id}
                              onConfirm={() => void run(reward._id, () => clearReview({ rewardId: reward._id }), 'Review cleared. The reward will release.')}
                            />
                          )}
                          {reward.status !== 'reversed' && (
                            <DangerConfirm
                              label="Reverse"
                              title={`Reverse every referral reward for booking ${reward.bookingId.slice(-6).toUpperCase()}?`}
                              confirmLabel="Confirm reverse"
                              busy={busy === reward._id}
                              onConfirm={(reason) => void run(reward._id, () => reverseReferral({ bookingId: reward.bookingId, reason }), 'Reward reversed.')}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel">
          <div className="panel-header"><h2 className="text-h2">Top referrers</h2></div>
          <div className="panel-body">
            {overview.topReferrers.length === 0 ? <p className="text-meta">No referrers yet.</p> : (
              <div className="worklist">
                {overview.topReferrers.map((referrer) => (
                  <article key={referrer.userId} className="worklist-row">
                    <div className="worklist-row-head">
                      <div>
                        <h3 className="text-h3">{referrer.displayName}</h3>
                        <p className="text-meta">{referrer.referrals} {referrer.referrals === 1 ? 'referral' : 'referrals'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-meta">{formatPhp(referrer.earnedCentavos)} credited</p>
                        <p className="text-meta">{formatPhp(referrer.pendingCentavos)} pending</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><h2 className="text-h2">Recent referrals</h2></div>
          <div className="panel-body">
            {overview.recentReferrals.length === 0 ? <p className="text-meta">No referrals yet.</p> : (
              <div className="worklist">
                {overview.recentReferrals.map((referral) => (
                  <article key={referral._id} className="worklist-row">
                    <div className="worklist-row-head">
                      <div>
                        <h3 className="text-h3">{referral.referrerDisplayName} → {referral.referredDisplayName}</h3>
                        <p className="text-meta">{referral.rewardedBookings} rewarded {referral.rewardedBookings === 1 ? 'booking' : 'bookings'} · {termsLabel(referral.termsVersion)}</p>
                      </div>
                      <span className="status-pill" data-tone={referral.status === 'reversed' ? 'danger' : 'social'}>{statusLabel(referral.status)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  )
}

function ConfirmAction({
  label,
  title,
  confirmLabel,
  busy,
  onConfirm,
}: {
  label: string
  title: string
  confirmLabel: string
  busy: boolean
  onConfirm: () => void
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className="btn btn-neutral btn-sm" disabled={busy} onClick={() => setOpen(true)}>
        {label}
      </button>
    )
  }

  return (
    <div className="w-full max-w-md space-y-2 rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-3">
      <p className="text-meta">{title}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-neutral btn-sm" disabled={busy} onClick={() => { onConfirm(); setOpen(false) }}>
          {confirmLabel}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function DangerConfirm({
  label,
  title,
  confirmLabel,
  busy,
  onConfirm,
}: {
  label: string
  title: string
  confirmLabel: string
  busy: boolean
  onConfirm: (reason: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (!open) {
    return (
      <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => setOpen(true)}>
        {label}
      </button>
    )
  }

  return (
    <div className="w-full max-w-md space-y-2 rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-3">
      <p className="text-meta">{title}</p>
      <input
        className="field"
        value={reason}
        onChange={(event) => setReason(event.currentTarget.value)}
        placeholder="Reason (required)"
        aria-label="Reason"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={!reason.trim() || busy}
          onClick={() => {
            onConfirm(reason.trim())
            setOpen(false)
            setReason('')
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function termsLabel(termsVersion: string) {
  return termsVersion === 'legacy_68_3' ? 'Legacy 68% terms' : '5% lifetime terms'
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function signalLabel(signal: string) {
  const words = signal.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function formatAdminDate(timestamp: number) {
  return `${new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)} PHT`
}

function rewardStatusLabel(status: string) {
  if (status === 'credited') return 'Available'
  if (status === 'pending') return 'Pending release'
  if (status === 'reversed') return 'Reversed'
  return status
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-stat">
      <span className="admin-stat-copy">
        <span className="admin-stat-value">{value}</span>
        <span className="admin-stat-label">{label}</span>
      </span>
    </div>
  )
}
