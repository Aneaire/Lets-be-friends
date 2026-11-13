import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useAuth } from '@clerk/react'
import { useEffect, useRef, useState } from 'react'
import { referralShareUrl } from '@lets-be-friends/shared'
import { api } from '../../../convex/_generated/api'
import { describeConvexError } from '../../lib/convexErrors'
import { ReferralCodeCard } from './ReferralCodeCard'
import { ReferralPanelView } from './ReferralPanelView'
import { webReferralDeviceId } from './referralDevice'
import { bindSavedReferralCode, clearSavedReferralCode, readSavedReferralCode } from './referralStorage'

const COPY_CONFIRMATION_MS = 2_000

export function ReferralPanel({ showHeader = true }: { showHeader?: boolean } = {}) {
  const { userId } = useAuth()
  const referral = useQuery(api.referrals.myReferral)
  const page = usePaginatedQuery(api.referrals.myReferralPage, {}, { initialNumItems: 10 })
  const rewardsPage = usePaginatedQuery(api.referrals.myReferralRewards, {}, { initialNumItems: 10 })
  const ensureReferralCode = useMutation(api.referrals.ensureReferralCode)
  const attributeReferral = useMutation(api.referrals.attributeReferral)
  const dismissReferralPrompt = useMutation(api.referrals.dismissReferralPrompt)
  const [busy, setBusy] = useState(false)
  const [friendBusy, setFriendBusy] = useState(false)
  const [error, setError] = useState('')
  const [friendError, setFriendError] = useState('')
  const [notice, setNotice] = useState('')
  const [friendNotice, setFriendNotice] = useState('')
  const [friendCardDismissed, setFriendCardDismissed] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (copyResetRef.current) clearTimeout(copyResetRef.current)
  }, [])

  useEffect(() => {
    if (!referral || !userId) return
    const saved = readSavedReferralCode(userId)
    if (!saved) return
    if (referral.referredBy || saved === referral.code) {
      clearSavedReferralCode()
      return
    }
    bindSavedReferralCode(userId)
  }, [userId, referral?.referredBy, referral?.code])

  if (referral === undefined) {
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
              <p className="text-meta mt-1">Earn 5% of the booking subtotal on every completed booking your friend makes, for life.</p>
            </div>
          </header>
        ) : null}
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
      await ensureReferralCode({ deviceId: webReferralDeviceId() })
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
      setCopied(true)
      if (copyResetRef.current) clearTimeout(copyResetRef.current)
      copyResetRef.current = setTimeout(() => setCopied(false), COPY_CONFIRMATION_MS)
    } catch {
      setError('The link could not be copied. Select it and copy it manually.')
      setCopied(false)
    }
  }

  async function addFriendCode(code: string) {
    if (friendBusy) return
    setFriendBusy(true)
    setFriendError('')
    setFriendNotice('')
    try {
      await attributeReferral({ code, deviceId: webReferralDeviceId() })
      clearSavedReferralCode()
      setFriendNotice('Referral code added. Your friend earns 5% of the booking subtotal on every completed booking, for life.')
    } catch (attributeError) {
      setFriendError(attributeError instanceof Error ? describeConvexError(attributeError) : 'We could not add this code. Check it and try again.')
    } finally {
      setFriendBusy(false)
    }
  }

  async function dismissFriendCode() {
    setFriendCardDismissed(true)
    clearSavedReferralCode()
    try {
      await dismissReferralPrompt({})
    } catch {
      // Hiding the card locally is still useful if the dismissal write fails.
    }
  }

  const friendCodeCard = referral.canAddReferralCode && !referral.promptDismissedAt && !friendCardDismissed ? (
    <ReferralCodeCard
      busy={friendBusy}
      error={friendError}
      notice={friendNotice}
      savedForUserId={userId ?? undefined}
      onSubmit={(code) => void addFriendCode(code)}
      onSkip={() => void dismissFriendCode()}
      onRemoveSaved={() => {
        clearSavedReferralCode()
        setFriendCardDismissed(true)
      }}
      onEdit={() => setFriendError('')}
    />
  ) : null

  return (
    <div>
      <ReferralPanelView
        referral={referral}
        items={page.results}
        status={page.status}
        rewardItems={rewardsPage.results}
        rewardStatus={rewardsPage.status}
        busy={busy}
        error={error}
        notice={notice}
        origin={origin}
        copied={copied}
        showHeader={showHeader}
        friendCodeCard={friendCodeCard}
        onCreateCode={() => void createCode()}
        onCopyLink={() => void copyLink()}
        onLoadMore={() => page.loadMore(10)}
        onLoadMoreRewards={() => rewardsPage.loadMore(10)}
      />
    </div>
  )
}
