import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useState } from 'react'
import { referralShareUrl } from '@lets-be-friends/shared'
import { api } from '../../../convex/_generated/api'
import { describeConvexError } from '../../lib/convexErrors'
import { ReferralPanelView } from './ReferralPanelView'

export function ReferralPanel() {
  const referral = useQuery(api.referrals.myReferral)
  const page = usePaginatedQuery(api.referrals.myReferralPage, {}, { initialNumItems: 10 })
  const ensureReferralCode = useMutation(api.referrals.ensureReferralCode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (referral === undefined) {
    return (
      <section id="referrals" className="mb-10" aria-labelledby="referrals-title">
        <header className="flex items-baseline justify-between gap-3 mb-3">
          <div>
            <h2 id="referrals-title" className="text-h2">Invite friends</h2>
            <p className="text-meta mt-1">Earn 68% of our service fee on each friend's first 3 completed bookings.</p>
          </div>
        </header>
        <div className="empty-state">Loading your referral link...</div>
      </section>
    )
  }

  if (referral === null) return null

  const origin = typeof window === 'undefined' ? '' : window.location.origin

  async function createCode() {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await ensureReferralCode({})
      setNotice('Your referral link is ready to share.')
    } catch (createError) {
      setError(createError instanceof Error ? describeConvexError(createError) : 'Your referral link could not be created.')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    if (!referral?.code) return
    setError('')
    try {
      await navigator.clipboard.writeText(referralShareUrl(origin, referral.code))
      setNotice('Referral link copied.')
    } catch {
      setError('The link could not be copied. Select it and copy it manually.')
    }
  }

  return (
    <ReferralPanelView
      referral={referral}
      items={page.results}
      status={page.status}
      busy={busy}
      error={error}
      notice={notice}
      origin={origin}
      onCreateCode={() => void createCode()}
      onCopyLink={() => void copyLink()}
      onLoadMore={() => page.loadMore(10)}
    />
  )
}
