import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { useMobileAuth } from '@/auth/MobileAuth'
import { buildMobileWebHandoffUrl, resolveMobileWebAppConfiguration } from '@/backend/config'
import { ActionButton } from '@/components/ActionButton'
import { Avatar } from '@/components/Avatar'
import { Screen, Section } from '@/components/Screen'
import { PushNotificationSettings } from '@/components/PushNotificationSettings'
import { TrustThread } from '@/components/TrustThread'
import { AppText } from '@/components/Typography'
import { useMobileMember } from '@/member/MobileMember'
import { buildSignedInProfileViewModel } from '@/member/profileViewModel'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function ProfileScreen() {
  const auth = useMobileAuth()
  const member = useMobileMember()

  if (auth.status === 'demo') return <DemoProfile />
  if (auth.status === 'setup_error') return <ProfileState title="Account services unavailable" detail="Account access is unavailable in this build." />
  if (auth.status === 'loading') return <ProfileState title="Loading your account" detail="Preparing secure account access." loading />
  if (auth.status === 'signed_out') return <SignedOutProfile />
  if (auth.status === 'needs_task') {
    return <SignedInUnavailableProfile message="Complete the required account security step before continuing." signOut={auth.signOut} />
  }
  if (member.status === 'loading' || member.status === 'syncing') {
    return <ProfileState title="Preparing your member profile" detail="Securely connecting your account to member data." loading />
  }
  if (member.status === 'unavailable' || member.status === 'error') {
    return <SignedInUnavailableProfile message={member.message} signOut={auth.signOut} />
  }
  if (member.status !== 'ready') {
    return <ProfileState title="Member profile unavailable" detail="Sign in again to reconnect your member profile." />
  }

  const profile = buildSignedInProfileViewModel(
    { ...member.viewer, profileImageUrl: member.viewer.profileImageUrl || auth.imageUrl },
    member.verification,
  )
  return <SignedInProfile profile={profile} signOut={auth.signOut} />
}

function DemoProfile() {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.eyebrowRow}>
        <AppText variant="label" color={theme.colors.self}>DEMO ACCOUNT</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>Stored on this device</AppText>
      </View>
      <View style={styles.identity}>
        <Avatar name="Demo member" size={86} />
        <View style={styles.identityCopy}>
          <AppText variant="title">Demo member</AppText>
          <AppText color={theme.colors.textMuted}>No signed-in identity</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>Example account only</AppText>
        </View>
      </View>
      <VerificationCard
        approved={false}
        label="Identity not verified"
        detail="Demo mode does not represent a real member or any identity approval."
      />
      <Section>
        <AppText variant="heading">Demo account limits</AppText>
        <View style={styles.threadWrap}>
          <TrustThread items={[
            { title: 'Example profile', detail: 'This profile is clearly labeled and is not connected to a person.', tone: 'self' },
            { title: 'No identity approval', detail: 'No verification or booking eligibility is claimed.', tone: 'self' },
            { title: 'Discovery examples', detail: 'Local Companion fixtures remain non-bookable.', tone: 'social' },
          ]} />
        </View>
      </Section>
      <UnavailableNotifications liveUnread={false} />
    </Screen>
  )
}

function SignedOutProfile() {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.state}>
      <AppText variant="label" color={theme.colors.self}>YOUR ACCOUNT</AppText>
      <AppText variant="display">Bring your member profile with you.</AppText>
      <AppText color={theme.colors.textMuted}>
        Sign in to view your real profile, onboarding state, role, and identity verification status.
      </AppText>
      <ActionButton label="Sign in or create account" onPress={() => router.push('/auth')} intent="self" />
      <AppText variant="caption" color={theme.colors.textMuted}>
        No member identity or verification is shown while signed out.
      </AppText>
    </Screen>
  )
}

function SignedInProfile({
  profile,
  signOut,
}: {
  profile: ReturnType<typeof buildSignedInProfileViewModel>
  signOut: () => Promise<void>
}) {
  const theme = useAppTheme()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)
  const [verificationHandoff, setVerificationHandoff] = useState<'idle' | 'opening' | 'error'>('idle')
  const verificationUrl = buildMobileWebHandoffUrl(resolveMobileWebAppConfiguration())

  async function openVerification() {
    if (!verificationUrl || verificationHandoff === 'opening') {
      setVerificationHandoff('error')
      return
    }
    setVerificationHandoff('opening')
    try {
      await Linking.openURL(verificationUrl)
      setVerificationHandoff('idle')
    } catch {
      setVerificationHandoff('error')
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    setSignOutError(false)
    try {
      await signOut()
      router.replace('/profile')
    } catch {
      setSignOutError(true)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.eyebrowRow}>
        <AppText variant="label" color={theme.colors.self}>YOUR ACCOUNT</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{profile.role}</AppText>
      </View>

      <View style={styles.identity}>
        <Avatar uri={profile.imageUrl} name={profile.name} size={86} />
        <View style={styles.identityCopy}>
          <AppText variant="title">{profile.name}</AppText>
          <AppText color={theme.colors.textMuted}>{profile.username}</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>{profile.memberSince}</AppText>
        </View>
      </View>

      <VerificationCard
        approved={profile.verificationApproved}
        label={profile.verificationLabel}
        detail={profile.verificationDetail}
      />
      {!profile.verificationApproved ? (
        <View style={styles.verificationAction}>
          <ActionButton
            label={verificationHandoff === 'opening' ? 'Opening verification' : 'Continue identity verification on web'}
            onPress={() => void openVerification()}
            intent="self"
            secondary
            disabled={verificationHandoff === 'opening'}
          />
          {verificationHandoff === 'error' ? (
            <AppText accessibilityLiveRegion="polite" variant="caption" color={theme.colors.textMuted}>
              Identity verification on the web is unavailable in this build.
            </AppText>
          ) : null}
        </View>
      ) : null}

      <Section>
        <AppText variant="heading">Your account status</AppText>
        <View style={styles.threadWrap}>
          <TrustThread items={[
            {
              title: profile.onboardingLabel,
              detail: profile.onboardingComplete
                ? 'Your permanent username and starting goal are saved.'
                : 'Choose a permanent username and starting goal to finish setup.',
              tone: 'self',
            },
            {
              title: profile.verificationLabel,
              detail: profile.verificationDetail,
              tone: 'self',
            },
            {
              title: profile.role,
              detail: 'This is the current role recorded for your member account.',
              tone: 'social',
            },
          ]} />
        </View>
        {!profile.onboardingComplete && (
          <ActionButton
            label="Finish welcome guide"
            onPress={() => router.push('/onboarding')}
            intent="self"
            secondary
            style={styles.sectionAction}
          />
        )}
      </Section>

      <Section>
        <AppText variant="heading">Booking wallet</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>View available, reserved, and pending balance or create a provider-confirmed QR Ph top-up.</AppText>
        <ActionButton label="Open booking wallet" onPress={() => router.push('/wallet')} intent="self" style={styles.sectionAction} />
      </Section>

      <Section>
        <AppText variant="heading">Companion</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>Apply, review profile status, manage your rate, or respond to incoming bookings.</AppText>
        <ActionButton label="Open Companion tools" onPress={() => router.push('/companion')} intent="self" secondary style={styles.sectionAction} />
        <ActionButton label="View incoming bookings" onPress={() => router.push('/companion-bookings')} style={styles.sectionAction} />
      </Section>

      <Section>
        <AppText variant="heading">Notifications</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>View your live in-app booking, social, account, and safety updates.</AppText>
        <ActionButton label="Open notifications" onPress={() => router.push('/notifications' as never)} intent="self" secondary style={styles.sectionAction} />
        <PushNotificationSettings />
      </Section>

      <Section>
        <AppText variant="heading">Account</AppText>
        <ActionButton
          label={signingOut ? 'Signing out' : 'Sign out'}
          onPress={() => void handleSignOut()}
          intent="self"
          secondary
          disabled={signingOut}
          style={styles.sectionAction}
        />
        {signOutError && (
          <AppText accessibilityLiveRegion="polite" variant="caption" color={theme.colors.textMuted}>
            Sign out could not be completed. Please try again.
          </AppText>
        )}
      </Section>
    </Screen>
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
      actionDisabled={signingOut}
      onAction={() => {
        setSigningOut(true)
        setSignOutError(false)
        void signOut()
          .catch(() => setSignOutError(true))
          .finally(() => setSigningOut(false))
      }}
      footer={signOutError ? 'Sign out could not be completed. Please try again.' : undefined}
    />
  )
}

function VerificationCard({ approved, label, detail }: { approved: boolean; label: string; detail: string }) {
  const theme = useAppTheme()
  return (
    <View style={[styles.verificationCard, { backgroundColor: theme.colors.selfSoft, borderColor: theme.colors.self }]}>
      <View style={[styles.check, { backgroundColor: approved ? theme.colors.self : theme.colors.background, borderColor: theme.colors.self }]}>
        <AppText variant="label" color={approved ? theme.colors.accentText : theme.colors.self}>{approved ? '✓' : '?'}</AppText>
      </View>
      <View style={styles.cardCopy}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{detail}</AppText>
      </View>
    </View>
  )
}

function UnavailableNotifications({ liveUnread }: { liveUnread: boolean }) {
  const theme = useAppTheme()
  return (
    <Section>
      <AppText variant="heading">Notifications</AppText>
      <View style={[styles.unavailableCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <AppText variant="bodyStrong">{liveUnread ? 'In-app unread state is live' : 'Notification preferences are not available yet'}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          {liveUnread
            ? 'The Messages tab badge updates from real conversation unread state. Push delivery is not connected.'
            : 'No local switches are shown because this demo is not connected to real unread state or push delivery.'}
        </AppText>
      </View>
    </Section>
  )
}

function ProfileState({
  title,
  detail,
  loading = false,
  actionLabel,
  actionDisabled = false,
  onAction,
  footer,
}: {
  title: string
  detail: string
  loading?: boolean
  actionLabel?: string
  actionDisabled?: boolean
  onAction?: () => void
  footer?: string
}) {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.state}>
      <AppText variant="label" color={theme.colors.self}>YOUR ACCOUNT</AppText>
      <AppText variant="title">{title}</AppText>
      <AppText color={theme.colors.textMuted}>{detail}</AppText>
      {loading && <ActivityIndicator accessibilityLabel="Loading member account" color={theme.colors.self} />}
      {actionLabel && onAction && (
        <ActionButton label={actionLabel} onPress={onAction} intent="self" secondary disabled={actionDisabled} />
      )}
      {footer && <AppText accessibilityLiveRegion="polite" variant="caption" color={theme.colors.textMuted}>{footer}</AppText>}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48 },
  eyebrowRow: { paddingTop: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 24 },
  identityCopy: { flex: 1, gap: 2 },
  verificationCard: { borderWidth: 1, borderRadius: 20, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 13 },
  verificationAction: { gap: 8 },
  check: { width: 34, height: 34, borderWidth: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, gap: 2 },
  threadWrap: { marginTop: 18 },
  unavailableCard: { borderWidth: 1, borderRadius: 20, padding: 17, marginTop: 14, gap: 4 },
  sectionAction: { marginTop: 16 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 18 },
})
