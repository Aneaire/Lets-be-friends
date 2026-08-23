import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { StyleSheet, View } from 'react-native'

import { useMobileAuth } from '@/auth/MobileAuth'
import { buildMobileWebHandoffUrl, resolveMobileWebAppConfiguration } from '@/backend/config'
import { mobileApi } from '@/backend/client'
import { Avatar } from '@/design-system/atoms/Avatar'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { PushNotificationSettings } from '@/features/settings/PushNotificationSettings'
import { Screen } from '@/design-system/templates/Screen'
import { SettingsRow } from '@/design-system/molecules/SettingsRow'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'
import { useMobileMember } from '@/member/MobileMember'
import { buildSignedInProfileViewModel } from '@/member/profileViewModel'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function ProfileScreen() {
  const auth = useMobileAuth()
  const member = useMobileMember()

  if (auth.status === 'unconfigured') return <ProfileState title="Account services unavailable" detail="This build cannot connect to your member profile." />
  if (auth.status === 'setup_error') return <ProfileState title="Account services unavailable" detail="Account access is unavailable in this build." />
  if (auth.status === 'loading') return <ProfileState title="Loading your account" detail="Preparing secure account access." loading />
  if (auth.status === 'signed_out') return <SignedOutProfile />
  if (auth.status === 'needs_task') return <SignedInUnavailableProfile message="Complete the required account security step before continuing." signOut={auth.signOut} />
  if (member.status === 'loading' || member.status === 'syncing') return <ProfileState title="Preparing your member profile" detail="Securely connecting your account to member data." loading />
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
  const theme = useAppTheme()
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
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="title">Profile</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>Your member account and settings</AppText>
      </View>

      <View style={[styles.memberCard, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}>
        <View style={styles.identity}>
          <Avatar uri={profile.imageUrl} name={profile.name} size={72} />
          <View style={styles.identityCopy}>
            <AppText variant="heading">{profile.name}</AppText>
            <AppText color={theme.colors.textMuted}>{profile.username}</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>{profile.memberSince} · {profile.role}</AppText>
          </View>
        </View>
        {bio ? <AppText color={theme.colors.textMuted}>{bio}</AppText> : null}

        <View style={[styles.verification, { backgroundColor: theme.colors.selfSoft, borderColor: theme.colors.self }]}>
          <View style={[styles.verificationMark, { backgroundColor: profile.verificationApproved ? theme.colors.self : theme.colors.background, borderColor: theme.colors.self }]}>
            <AppText variant="label" color={profile.verificationApproved ? theme.colors.accentText : theme.colors.selfText}>{profile.verificationApproved ? '✓' : '?'}</AppText>
          </View>
          <View style={styles.identityCopy}>
            <AppText variant="bodyStrong">{profile.verificationLabel}</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>{profile.verificationDetail}</AppText>
          </View>
        </View>
      </View>

      <SettingsGroup title="Account">
        <SettingsRow icon="person-outline" label="Edit profile" detail="Update your display name, bio, and profile photo" onPress={() => router.push('/profile-edit' as never)} />
        {!profile.onboardingComplete ? <SettingsRow icon="sparkles-outline" label="Finish welcome guide" detail={profile.onboardingLabel} onPress={() => router.push('/onboarding')} /> : null}
        {!profile.verificationApproved ? <SettingsRow icon="shield-checkmark-outline" label={openingVerification ? 'Opening identity verification' : 'Identity verification'} detail="Continue to secure identity verification" onPress={() => void openVerification()} /> : <SettingsRow icon="shield-checkmark" label="Identity verification" detail="Current approval is active" value="Approved" />}
        <SettingsRow icon="notifications-outline" label="Notification center" detail="Booking, social, account, and safety updates" onPress={() => router.push('/notifications')} />
        <View style={styles.pushSettings}><PushNotificationSettings /></View>
      </SettingsGroup>

      <SettingsGroup title="Bookings and money">
        <SettingsRow icon="calendar-outline" label="Bookings" detail="Upcoming, requests, and past experiences" onPress={() => router.push('/bookings' as never)} />
        <SettingsRow icon="wallet-outline" label="Booking wallet" detail="Available, reserved, and pending member balance" onPress={() => router.push('/wallet')} />
      </SettingsGroup>

      <SettingsGroup title="Companion">
        {hasCompanionTools ? <SettingsRow icon="people-outline" label="Companion tools" detail="What you offer, your public profile, Strengths, and rate" onPress={() => router.push('/companion')} /> : <SettingsRow icon="person-add-outline" label="Become a Companion" detail="Share everyday Strengths, help someone, and earn on your terms" onPress={() => router.push('/companion')} />}
        {approvedCompanion ? <SettingsRow icon="mail-open-outline" label="Incoming bookings" detail="Review and respond to member requests" onPress={() => router.push('/companion-bookings')} /> : null}
        {approvedCompanion ? <SettingsRow icon="stats-chart-outline" label="Companion finance" detail="Earnings, fees, obligations, and history" onPress={() => router.push('/companion-finance' as never)} /> : null}
      </SettingsGroup>

      <SettingsGroup title="Safety and support">
        <SettingsRow icon="shield-outline" label="Safety Center" detail="Meeting guidance, reports, blocked members, and muted members" onPress={() => router.push('/safety' as never)} />
      </SettingsGroup>

      <SettingsGroup title="Session">
        <SettingsRow icon="log-out-outline" label={signingOut ? 'Signing out' : 'Sign out'} detail="End this session on this device" danger onPress={() => void handleSignOut()} />
      </SettingsGroup>

    </Screen>
  )
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useAppTheme()
  return <View style={styles.group}><AppText variant="label" color={theme.colors.selfText}>{title.toUpperCase()}</AppText><View style={[styles.rows, { borderColor: theme.colors.border }]}>{children}</View></View>
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
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  state: { paddingHorizontal: 16 },
  header: { paddingTop: 12, gap: 2 },
  memberCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 14 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityCopy: { flex: 1, gap: 2 },
  verification: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  verificationMark: { width: 32, height: 32, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  group: { gap: 8 },
  rows: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, overflow: 'hidden' },
  pushSettings: { paddingBottom: 12 },
})
