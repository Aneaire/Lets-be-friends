import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Linking, StyleSheet, View } from 'react-native'

import { normalizeReferralCode, referralCodeValidationError } from '@lets-be-friends/shared'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { resolveMobileWebAppConfiguration } from '@/backend/config'
import { ReferralState } from '@/features/referral/ReferralState'
import { useAppTheme } from '@/theme/ThemeProvider'
import { savePendingReferralCode } from '@/features/referral/pendingReferralCode'
import { useMobileMember } from '@/member/MobileMember'

/**
 * Public landing route for app links and the custom scheme. The code is
 * saved before any sign-in so a new member keeps the invitation through
 * onboarding, where the claim card prefills it and still requires an explicit
 * "Add referral code" tap.
 */
function InvitationPage({ code, saved }: { code: string; saved: boolean }) {
  const theme = useAppTheme()
  const web = resolveMobileWebAppConfiguration()
  const safetyUrl = web.status === 'configured' ? `${web.url.replace(/\/+$/, '')}/safety` : undefined

  return (
    <Screen contentStyle={styles.content}>
      <AppText variant="label" color={theme.colors.socialText}>A LITTLE INVITATION FOR YOU</AppText>
      <AppText variant="display">Good company starts here.</AppText>
      <AppText color={theme.colors.textMuted}>
        A friend invited you to Let's Be Friends. Find everyday help, share an activity, and make room for a new connection.
      </AppText>

      <View style={[styles.codeCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <AppText variant="label" color={theme.colors.textMuted}>YOUR INVITATION CODE</AppText>
        <AppText variant="title">{code}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          {saved ? 'Saved. Add it before your first booking.' : 'Saving your invitation...'}
        </AppText>
      </View>

      <ActionButton label="Sign in or create an account" intent="self" onPress={() => router.replace('/auth')} />
      {safetyUrl ? (
        <ActionButton label="How safety works" intent="neutral" secondary onPress={() => void Linking.openURL(safetyUrl)} />
      ) : null}

      <AppText variant="caption" color={theme.colors.textMuted}>
        Your friend earns 5% of the booking subtotal on every completed booking. You pay the normal price.
      </AppText>
    </Screen>
  )
}

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

  return <InvitationPage code={code} saved={saved} />
}


const styles = StyleSheet.create({
  content: { paddingTop: 32, paddingBottom: 40, gap: 16 },
  codeCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 6 },
})
