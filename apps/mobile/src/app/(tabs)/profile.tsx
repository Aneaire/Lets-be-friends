import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { StyleSheet } from 'react-native'

import { useMobileAuth } from '@/auth/MobileAuth'
import { buildMobileWebHandoffUrl, resolveMobileWebAppConfiguration } from '@/backend/config'
import { mobileApi } from '@/backend/client'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { PushNotificationSettings } from '@/features/settings/PushNotificationSettings'
import { SignedInProfileContent } from '@/member/ProfileContent'
import { useMobileMember } from '@/member/MobileMember'
import { buildSignedInProfileViewModel } from '@/member/profileViewModel'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'

export default function ProfileScreen() {
  const auth = useMobileAuth()
  const member = useMobileMember()

  if (auth.status === 'unconfigured') return <ProfileState title="Account services unavailable" detail="This build cannot connect to your member profile." />
  if (auth.status === 'setup_error') return <ProfileState title="Account services unavailable" detail="Account access is unavailable in this build." />
  if (auth.status === 'loading') return <PageSkeleton variant="profile" />
  if (auth.status === 'signed_out') return <SignedOutProfile />
  if (auth.status === 'needs_task') return <SignedInUnavailableProfile message="Complete the required account security step before continuing." signOut={auth.signOut} />
  if (member.status === 'loading' || member.status === 'syncing') return <PageSkeleton variant="profile" />
  if (member.status === 'unavailable' || member.status === 'error') return <SignedInUnavailableProfile message={member.message} signOut={auth.signOut} />
  if (member.status !== 'ready') return <ProfileState title="Member profile unavailable" detail="Sign in again to reconnect your member profile." />

  const profile = buildSignedInProfileViewModel(
    { ...member.viewer, profileImageUrl: member.viewer.profileImageUrl || auth.imageUrl },
    member.verification,
  )
  return <SignedInProfile profile={profile} bio={member.viewer.bio} role={member.viewer.role} signOut={auth.signOut} />
}

function SignedOutProfile() {
  return (
    <Screen scroll={false} contentStyle={styles.state}>
      <StateView
        eyebrow="YOUR ACCOUNT"
        title="Bring your member profile with you"
        detail="Sign in to view and edit your real profile, account status, bookings, wallet, and notification settings."
        actionLabel="Sign in or create account"
        onAction={() => router.push('/auth')}
        intent="self"
      />
    </Screen>
  )
}

function SignedInProfile({ profile, bio, role, signOut }: {
  profile: ReturnType<typeof buildSignedInProfileViewModel>
  bio?: string
  role: string
  signOut: () => Promise<void>
}) {
  const [signingOut, setSigningOut] = useState(false)
  const [message, setMessage] = useState('')
  useAppToastMessage(message)
  const [openingVerification, setOpeningVerification] = useState(false)
  const verificationUrl = buildMobileWebHandoffUrl(resolveMobileWebAppConfiguration(), { intent: 'member', mobileReturn: 'profile' })
  const companionApplication = useQuery(mobileApi.companions.myApplication, {})
  const hasCompanionTools = role === 'companion' || Boolean(companionApplication)
  const approvedCompanion = companionApplication?.status === 'approved'

  async function openVerification() {
    if (!verificationUrl || openingVerification) {
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

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    setMessage('')
    try {
      await signOut()
      router.replace('/profile')
    } catch {
      setMessage('Sign out could not be completed. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <SignedInProfileContent
      profile={profile}
      bio={bio}
      hasCompanionTools={hasCompanionTools}
      approvedCompanion={approvedCompanion}
      openingVerification={openingVerification}
      signingOut={signingOut}
      pushNotifications={<PushNotificationSettings />}
      onEditProfile={() => router.push('/profile-edit' as never)}
      onFinishWelcomeGuide={() => router.push('/onboarding')}
      onOpenVerification={() => void openVerification()}
      onOpenNotificationCenter={() => router.push('/notifications')}
      onOpenBookings={() => router.push('/bookings' as never)}
      onOpenWallet={() => router.push('/wallet')}
      onOpenCompanion={() => router.push('/companion')}
      onOpenIncomingBookings={() => router.push('/companion-bookings')}
      onOpenCompanionFinance={() => router.push('/companion-finance' as never)}
      onOpenSafety={() => router.push('/safety' as never)}
      onSignOut={() => void handleSignOut()}
    />
  )
}

function SignedInUnavailableProfile({ message, signOut }: { message: string; signOut: () => Promise<void> }) {
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)
  return (
    <ProfileState
      title="Member profile unavailable"
      detail={message}
      actionLabel={signingOut ? 'Signing out' : 'Sign out'}
      onAction={() => {
        if (signingOut) return
        setSigningOut(true)
        setSignOutError(false)
        void signOut().catch(() => setSignOutError(true)).finally(() => setSigningOut(false))
      }}
      footer={signOutError ? 'Sign out could not be completed. Please try again.' : undefined}
    />
  )
}

function ProfileState({ title, detail, loading = false, actionLabel, onAction, footer }: {
  title: string
  detail: string
  loading?: boolean
  actionLabel?: string
  onAction?: () => void
  footer?: string
}) {
  return (
    <Screen scroll={false} contentStyle={styles.state}>
      <StateView eyebrow="YOUR ACCOUNT" title={title} detail={detail} loading={loading} actionLabel={actionLabel} onAction={onAction} intent="self" />
      {footer ? <AppText accessibilityRole="alert" variant="caption">{footer}</AppText> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  state: { paddingHorizontal: 16 },
})
