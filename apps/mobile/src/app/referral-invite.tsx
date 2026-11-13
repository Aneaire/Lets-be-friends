import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'

import { normalizeReferralCode, referralCodeValidationError } from '@lets-be-friends/shared'

import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { ReferralState } from '@/features/referral/ReferralState'
import { savePendingReferralCode } from '@/features/referral/pendingReferralCode'
import { useMobileMember } from '@/member/MobileMember'

/**
 * Public landing route for app links and the custom scheme. The code is
 * saved before any sign-in so a new member keeps the invitation through
 * onboarding, where the claim card prefills it and still requires an explicit
 * "Add referral code" tap.
 */
export default function ReferralInviteScreen() {
  const params = useLocalSearchParams<{ ref?: string }>()
  const member = useMobileMember()
  const [saved, setSaved] = useState(false)
  const code = typeof params.ref === 'string' ? normalizeReferralCode(params.ref) : ''
  const invalid = !code || referralCodeValidationError(code) !== null

  useEffect(() => {
    if (invalid) return
    void savePendingReferralCode(code).finally(() => setSaved(true))
  }, [code, invalid])

  useEffect(() => {
    if (!saved || member.status !== 'ready') return
    router.replace(`/referrals?ref=${encodeURIComponent(code)}`)
  }, [code, member.status, saved])

  if (invalid) {
    return (
      <ReferralState
        title="This invitation link is incomplete"
        detail="Ask your friend to share the link again, or add the code from the referrals screen."
        action={member.status === 'ready' ? 'Go to referrals' : 'Sign in'}
        onPress={() => router.replace(member.status === 'ready' ? '/referrals' : '/auth')}
      />
    )
  }

  if (member.status === 'loading' || member.status === 'syncing' || (member.status === 'ready' && !saved)) {
    return <PageSkeleton variant="profile" />
  }

  if (member.status === 'ready') return <PageSkeleton variant="profile" />

  if (member.status === 'unconfigured' || member.status === 'unavailable' || member.status === 'error') {
    return (
      <ReferralState
        title="Referrals are unavailable"
        detail={member.status === 'unconfigured' ? 'This build cannot connect to your member account.' : member.message}
        action="Return to Profile"
        onPress={() => router.replace('/profile')}
      />
    )
  }

  const signedOut = member.status === 'signed_out'
  return (
    <ReferralState
      title="You were invited to Let's Be Friends"
      detail={signedOut
        ? 'Your invitation is saved. Sign in or create an account, then add the code before your first booking.'
        : 'Your invitation is saved. Add the code from the referrals screen before your first booking.'}
      action={signedOut ? 'Sign in or create an account' : 'Go to referrals'}
      onPress={() => router.replace(signedOut ? '/auth' : '/referrals')}
    />
  )
}
