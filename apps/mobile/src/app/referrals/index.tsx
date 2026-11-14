import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Linking, Share } from 'react-native'
import { extractConvexErrorMessage, normalizeReferralCode, referralCodeValidationError, referralShareUrl } from '@lets-be-friends/shared'

import { mobileApi } from '@/backend/client'
import { resolveMobileWebAppConfiguration } from '@/backend/config'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { ReferralCodeCard } from '@/features/referral/ReferralCodeCard'
import { clearPendingReferralCode, readPendingReferralCode, savePendingReferralCode } from '@/features/referral/pendingReferralCode'
import { mobileReferralDeviceId } from '@/features/referral/referralDevice'
import { ReferralState } from '@/features/referral/ReferralState'
import { ReferralsView } from '@/features/referral/ReferralsView'
import { useMobileMember } from '@/member/MobileMember'

export default function ReferralsScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') {
    return <ReferralState title="Sign in to invite friends" detail="Your referral link is connected to your member account." action="Sign in" onPress={() => router.replace('/auth')} />
  }
  if (member.status === 'unconfigured') {
    return <ReferralState title="Referrals need account services" detail="This build cannot connect to your member account." action="Return to Profile" onPress={() => router.replace('/profile')} />
  }
  if (member.status === 'unavailable' || member.status === 'error') {
    return <ReferralState title="Referrals are unavailable" detail={member.message} action="Return to Profile" onPress={() => router.replace('/profile')} />
  }
  if (member.status !== 'ready') return <PageSkeleton variant="profile" />
  return <ReadyReferrals />
}

function ReadyReferrals() {
  const params = useLocalSearchParams<{ ref?: string }>()
  const referral = useQuery(mobileApi.referrals.myReferral, {})
  const page = usePaginatedQuery(mobileApi.referrals.myReferralPage, {}, { initialNumItems: 20 })
  const rewardPage = usePaginatedQuery(mobileApi.referrals.myReferralRewards, {}, { initialNumItems: 20 })
  const ensureReferralCode = useMutation(mobileApi.referrals.ensureReferralCode)
  const attributeReferral = useMutation(mobileApi.referrals.attributeReferral)
  const dismissReferralPrompt = useMutation(mobileApi.referrals.dismissReferralPrompt)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [friendBusy, setFriendBusy] = useState(false)
  const [friendError, setFriendError] = useState('')
  const [friendNotice, setFriendNotice] = useState('')
  const [friendDismissed, setFriendDismissed] = useState(false)
  const [initialCode, setInitialCode] = useState('')
  const [ownCodeNotice, setOwnCodeNotice] = useState('')

  useEffect(() => {
    let active = true
    const incoming = typeof params.ref === 'string' ? normalizeReferralCode(params.ref) : ''
    if (incoming && !referralCodeValidationError(incoming)) {
      setInitialCode(incoming)
      void savePendingReferralCode(incoming)
      return () => {
        active = false
      }
    }
    void readPendingReferralCode().then((code) => {
      if (active && code) setInitialCode(code)
    })
    return () => {
      active = false
    }
  }, [params.ref])

  if (referral === undefined) return <PageSkeleton variant="profile" />
  if (referral === null) {
    return <ReferralState title="Referrals are unavailable" detail="Your referral details could not be loaded." action="Return to Profile" onPress={() => router.replace('/profile')} />
  }

  const referralCode = referral.code
  const web = resolveMobileWebAppConfiguration()
  const shareUrl = referralCode && web.status === 'configured'
    ? referralShareUrl(web.url, referralCode)
    : undefined
  const termsUrl = web.status === 'configured'
    ? `${web.url.replace(/\/+$/, '')}/referral-terms`
    : undefined

  async function createCode() {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const deviceId = await mobileReferralDeviceId()
      await ensureReferralCode(deviceId ? { deviceId } : {})
      setMessage('Your referral link is ready to share.')
    } catch {
      setMessage('Your referral link could not be created. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function shareLink() {
    if (!referralCode) return
    setMessage('')
    try {
      await Share.share({
        message: shareUrl
          ? `Join me on Let's Be Friends: ${shareUrl}\nCode: ${referralCode}`
          : `Join me on Let's Be Friends. Use my referral code ${referralCode}.`,
      })
    } catch {
      setMessage('The share sheet could not be opened.')
    }
  }

  async function addFriendCode(code: string) {
    if (friendBusy) return
    setFriendBusy(true)
    setFriendError('')
    setFriendNotice('')
    try {
      const deviceId = await mobileReferralDeviceId()
      await attributeReferral(deviceId ? { code, deviceId } : { code })
      await clearPendingReferralCode()
      setInitialCode('')
      setFriendNotice('Referral code added. Your friend earns 5% of the booking subtotal on every completed booking, for life.')
    } catch (caught) {
      setFriendError(extractConvexErrorMessage(caught, 'We could not add this code. Check it and try again.'))
    } finally {
      setFriendBusy(false)
    }
  }

  useEffect(() => {
    if (referral.code && initialCode && referral.code === initialCode) {
      setOwnCodeNotice('This is your own code. Share it with a friend so they can join.')
      setInitialCode('')
      void clearPendingReferralCode()
    }
  }, [initialCode, referral.code])
  async function dismissFriendCode() {
    setFriendDismissed(true)
    try {
      await dismissReferralPrompt({})
    } catch {
      // Hiding the card locally is still useful if the dismissal write fails.
    }
  }

  // A member who already opted out stays opted out, unless an invitation
  // arrives through a link, which should still be claimable.
  const showFriendCodeCard = referral.canAddReferralCode
    && !friendDismissed
    && !ownCodeNotice
    && (!referral.promptDismissedAt || Boolean(initialCode))
  const friendCodeCard = showFriendCodeCard ? (
    <ReferralCodeCard
      busy={friendBusy}
      error={friendError}
      notice={friendNotice}
      initialCode={initialCode}
      onSubmit={(code) => void addFriendCode(code)}
      onSkip={() => void dismissFriendCode()}
      onRemove={() => {
        setInitialCode('')
        setFriendDismissed(true)
        void clearPendingReferralCode()
      }}
      onEdit={() => setFriendError('')}
    />
  ) : null

  return (
    <ReferralsView
      referral={referral}
      items={page.results}
      rewardItems={rewardPage.results}
      status={page.status}
      rewardStatus={rewardPage.status}
      busy={busy}
      message={ownCodeNotice || message}
      shareUrl={shareUrl}
      friendCodeCard={friendCodeCard}
      onCreateCode={() => void createCode()}
      onShare={() => void shareLink()}
      onBack={() => router.back()}
      onLoadMore={() => page.loadMore(20)}
      onLoadMoreRewards={() => rewardPage.loadMore(20)}
      onOpenTerms={termsUrl ? () => void Linking.openURL(termsUrl) : undefined}
    />
  )
}
