import * as Linking from 'expo-linking'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useState } from 'react'
import { useQuery } from 'convex/react'

import { useMobileAuth } from '@/auth/MobileAuth'
import { buildMobileWebHandoffUrl, resolveMobileWebAppConfiguration } from '@/backend/config'
import { mobileApi } from '@/backend/client'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { AppearanceSettings } from '@/features/settings/AppearanceSettings'
import { PushNotificationSettings } from '@/features/settings/PushNotificationSettings'
import { SettingsContent } from '@/features/settings/SettingsContent'
import { useAccountSignOut } from '@/features/account/useAccountSignOut'
import { settingsAccountModel } from '@/features/settings/settingsAccountModel'
import { buildSignedInProfileViewModel } from '@/member/profileViewModel'
import { useMobileMember } from '@/member/MobileMember'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { StateView } from '@/design-system/molecules/StateView'

export default function SettingsScreen() {
  const auth = useMobileAuth()
  const member = useMobileMember()

  if (auth.status === 'unconfigured') return <SettingsState title="Account services unavailable" detail="This build cannot connect to your settings." />
  if (auth.status === 'setup_error') return <SettingsState title="Account services unavailable" detail="Account access is unavailable in this build." />
  if (auth.status === 'loading') return <PageSkeleton variant="profile" />
  if (auth.status === 'signed_out') return <SettingsState title="Sign in to change settings" detail="Settings are connected to your member account." action="Sign in" onPress={() => router.push('/auth')} />
  if (auth.status === 'needs_task') return <SettingsState title="Settings unavailable" detail="Complete the required account security step before continuing." />
  if (member.status === 'loading' || member.status === 'syncing') return <PageSkeleton variant="profile" />
  if (member.status === 'unavailable' || member.status === 'error') return <SettingsState title="Settings unavailable" detail={member.message} />
  if (member.status !== 'ready') return <SettingsState title="Settings unavailable" detail="Sign in again to reconnect your member profile." />

  return <ReadySettings signOut={auth.signOut} viewer={member.viewer} verification={member.verification} />
}

export function ReadySettings({
  signOut,
  viewer,
  verification,
}: {
  signOut: () => Promise<void>
  viewer: Extract<ReturnType<typeof useMobileMember>, { status: 'ready' }>['viewer']
  verification: Extract<ReturnType<typeof useMobileMember>, { status: 'ready' }>['verification']
}) {
  const [message, setMessage] = useState('')
  useAppToastMessage(message)
  const [openingVerification, setOpeningVerification] = useState(false)
  const verificationUrl = buildMobileWebHandoffUrl(resolveMobileWebAppConfiguration(), { intent: 'member', mobileReturn: 'profile' })
  const application = useQuery(mobileApi.companions.myApplication, {})
  const profile = buildSignedInProfileViewModel(viewer, verification)
  // Approved identity needs no new flow: the row stays display-only and the
  // web handoff only opens for verify, continue, and retry actions.
  const accountModel = settingsAccountModel({
    verificationStatus: viewer.verificationStatus,
    verification,
    identityEligible: profile.verificationApproved,
    applicationStatus: application?.status ?? null,
  })
  const verificationAction = accountModel.verificationAction
  const { signingOut, signOutError, runSignOut } = useAccountSignOut({
    accountId: String(viewer._id),
    signOut,
    onSignedOut: () => router.replace('/profile'),
  })

  async function openVerification() {
    if (verificationAction === 'none' || openingVerification) return
    if (!verificationUrl) {
      setMessage('Identity verification on the web is unavailable in this build.')
      return
    }
    setOpeningVerification(true)
    setMessage('')
    try {
      await Linking.openURL(verificationUrl)
    } catch {
      setMessage('Identity verification on the web could not be opened. Please try again.')
    } finally {
      setOpeningVerification(false)
    }
  }

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace('/profile')
  }

  return (
    <SettingsContent
        pushNotifications={<PushNotificationSettings />}
        appearanceSettings={<AppearanceSettings />}
        verificationValue={profile.verificationApproved ? 'Approved' : undefined}
        verificationDetail={profile.verificationDetail}
        verificationAction={verificationAction}
        openingVerification={openingVerification}
        signingOut={signingOut}
        signOutError={signOutError}
        showWithdrawals={accountModel.showWithdrawals}
        showIncomingBookings={accountModel.showCompanionSections}
        showCompanionFinance={accountModel.showCompanionSections}
        onEditProfile={() => router.push('/profile-edit' as never)}
        onFinishWelcomeGuide={() => router.push('/onboarding')}
        onOpenVerification={() => void openVerification()}
        onOpenNotificationCenter={() => router.push('/notifications')}
        onOpenMyPosts={() => router.push('/my-posts' as never)}
        onOpenBookings={() => router.push('/bookings' as never)}
        onOpenWallet={() => router.push('/wallet')}
        onOpenWithdrawals={() => router.push('/companion-finance' as never)}
        onOpenCompanion={() => router.push('/companion')}
        onOpenIncomingBookings={() => router.push('/companion-bookings')}
        onOpenCompanionFinance={() => router.push('/companion-finance' as never)}
        onOpenSafety={() => router.push('/safety' as never)}
        onOpenTerms={() => router.push('/terms-and-conditions')}
        onOpenPrivacy={() => router.push('/privacy-policy')}
        onSignOut={() => void runSignOut()}
        onBack={goBack}
      />
  )
}

function SettingsState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  return <Screen scroll={false} contentStyle={{ paddingHorizontal: 16 }}><StateView eyebrow="SETTINGS" title={title} detail={detail} actionLabel={action} onAction={onPress} intent="self" /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <SettingsState title="Settings are temporarily unavailable" detail="No settings were changed." action="Try again" onPress={retry} />
}
