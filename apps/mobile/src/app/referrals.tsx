import { router } from 'expo-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { Share, StyleSheet } from 'react-native'
import {
  normalizeReferralCode,
  referralCodeValidationError,
  referralShareUrl,
} from '@lets-be-friends/shared'

import { mobileApi } from '@/backend/client'
import { resolveMobileWebAppConfiguration } from '@/backend/config'
import { StateView } from '@/design-system/molecules/StateView'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { Screen } from '@/design-system/templates/Screen'
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
  const referral = useQuery(mobileApi.referrals.myReferral, {})
  const ensureReferralCode = useMutation(mobileApi.referrals.ensureReferralCode)
  const attributeReferral = useMutation(mobileApi.referrals.attributeReferral)
  const [busy, setBusy] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [message, setMessage] = useState('')

  if (referral === undefined) return <PageSkeleton variant="profile" />
  if (referral === null) {
    return <ReferralState title="Referrals are unavailable" detail="Your referral details could not be loaded." action="Return to Profile" onPress={() => router.replace('/profile')} />
  }

  const referralCode = referral.code
  const web = resolveMobileWebAppConfiguration()
  const shareUrl = referralCode && web.status === 'configured'
    ? referralShareUrl(web.url, referralCode)
    : undefined

  async function createCode() {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      await ensureReferralCode({})
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
          ? `Join me on Let's Be Friends: ${shareUrl}`
          : `Join me on Let's Be Friends. Use my referral code ${referralCode}.`,
      })
    } catch {
      setMessage('The share sheet could not be opened.')
    }
  }

  async function submitCode() {
    if (busy) return
    const code = normalizeReferralCode(codeInput)
    const validationError = referralCodeValidationError(code)
    if (validationError) {
      setMessage(validationError)
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await attributeReferral({ code })
      setCodeInput('')
      setMessage('Referral code added. It will apply to your first completed bookings.')
    } catch {
      setMessage('That referral code could not be added. It may already be linked, or your first booking may already exist.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ReferralsView
      referral={referral}
      busy={busy}
      message={message}
      codeInput={codeInput}
      shareUrl={shareUrl}
      onCodeInputChange={setCodeInput}
      onCreateCode={() => void createCode()}
      onShare={() => void shareLink()}
      onSubmitCode={() => void submitCode()}
      onReturn={() => router.replace('/profile')}
    />
  )
}

function ReferralState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  return (
    <Screen scroll={false} contentStyle={styles.state}>
      <StateView eyebrow="INVITE FRIENDS" title={title} detail={detail} actionLabel={action} onAction={onPress} intent="social" />
    </Screen>
  )
}

const styles = StyleSheet.create({
  state: { paddingHorizontal: 16 },
})
