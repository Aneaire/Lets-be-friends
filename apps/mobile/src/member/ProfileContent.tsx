import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { Avatar } from '@/design-system/atoms/Avatar'
import { AppText } from '@/design-system/atoms/Typography'
import { SettingsRow } from '@/design-system/molecules/SettingsRow'
import { Screen } from '@/design-system/templates/Screen'
import { type ProfileViewModel } from '@/member/profileViewModel'
import { useAppTheme } from '@/theme/ThemeProvider'

export function SignedInProfileContent({
  profile,
  bio,
  hasCompanionTools,
  approvedCompanion,
  openingVerification,
  signingOut,
  pushNotifications,
  onEditProfile,
  onFinishWelcomeGuide,
  onOpenVerification,
  onOpenNotificationCenter,
  onOpenBookings,
  onOpenWallet,
  onOpenCompanion,
  onOpenIncomingBookings,
  onOpenCompanionFinance,
  onOpenSafety,
  onSignOut,
}: {
  profile: ProfileViewModel
  bio?: string
  hasCompanionTools: boolean
  approvedCompanion: boolean
  openingVerification: boolean
  signingOut: boolean
  pushNotifications?: ReactNode
  onEditProfile: () => void
  onFinishWelcomeGuide: () => void
  onOpenVerification: () => void
  onOpenNotificationCenter: () => void
  onOpenBookings: () => void
  onOpenWallet: () => void
  onOpenCompanion: () => void
  onOpenIncomingBookings: () => void
  onOpenCompanionFinance: () => void
  onOpenSafety: () => void
  onSignOut: () => void
}) {
  const theme = useAppTheme()
  const { colors } = theme

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="title">Profile</AppText>
        <AppText variant="caption" color={colors.textMuted}>Your member account and settings</AppText>
      </View>

      <View style={styles.identityRow}>
        <Avatar uri={profile.imageUrl} name={profile.name} size={72} />
        <View style={styles.identityCopy}>
          <AppText variant="heading">{profile.name}</AppText>
          <AppText color={colors.textMuted}>{profile.username}</AppText>
          <AppText variant="caption" color={colors.textMuted}>{profile.memberSince} · {profile.role}</AppText>
        </View>
      </View>
      {bio ? <AppText color={colors.textMuted}>{bio}</AppText> : null}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.trustLine}>
        <View style={[styles.trustMark, { backgroundColor: profile.verificationApproved ? colors.self : colors.background, borderColor: colors.self }]}>
          <AppText variant="label" color={profile.verificationApproved ? colors.accentText : colors.selfText}>{profile.verificationApproved ? '✓' : '?'}</AppText>
        </View>
        <View style={styles.identityCopy}>
          <AppText variant="bodyStrong">{profile.verificationLabel}</AppText>
          <AppText variant="caption" color={colors.textMuted}>{profile.verificationDetail}</AppText>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <SettingsGroup title="Account">
        <SettingsRow icon="person-outline" label="Edit profile" detail="Update your display name, bio, and profile photo" onPress={onEditProfile} />
        {!profile.onboardingComplete ? <SettingsRow icon="sparkles-outline" label="Finish welcome guide" detail={profile.onboardingLabel} onPress={onFinishWelcomeGuide} /> : null}
        {!profile.verificationApproved ? <SettingsRow icon="shield-checkmark-outline" label={openingVerification ? 'Opening identity verification' : 'Identity verification'} detail="Continue to secure identity verification" onPress={onOpenVerification} /> : <SettingsRow icon="shield-checkmark" label="Identity verification" detail="Current approval is active" value="Approved" />}
        <SettingsRow icon="notifications-outline" label="Notification center" detail="Booking, social, account, and safety updates" onPress={onOpenNotificationCenter} />
        {pushNotifications ? <View style={styles.pushSettings}>{pushNotifications}</View> : null}
      </SettingsGroup>

      <SettingsGroup title="Bookings and money">
        <SettingsRow icon="calendar-outline" label="Bookings" detail="Upcoming, requests, and past experiences" onPress={onOpenBookings} />
        <SettingsRow icon="wallet-outline" label="Booking wallet" detail="Available, reserved, and pending member balance" onPress={onOpenWallet} />
      </SettingsGroup>

      <SettingsGroup title="Companion">
        {hasCompanionTools ? <SettingsRow icon="people-outline" label="Companion tools" detail="What you offer, your public profile, Strengths, and rate" onPress={onOpenCompanion} /> : <SettingsRow icon="person-add-outline" label="Become a Companion" detail="Share everyday Strengths, help someone, and earn on your terms" onPress={onOpenCompanion} />}
        {approvedCompanion ? <SettingsRow icon="mail-open-outline" label="Incoming bookings" detail="Review and respond to member requests" onPress={onOpenIncomingBookings} /> : null}
        {approvedCompanion ? <SettingsRow icon="stats-chart-outline" label="Companion finance" detail="Earnings, fees, obligations, and history" onPress={onOpenCompanionFinance} /> : null}
      </SettingsGroup>

      <SettingsGroup title="Safety and support">
        <SettingsRow icon="shield-outline" label="Safety Center" detail="Meeting guidance, reports, blocked members, and muted members" onPress={onOpenSafety} />
      </SettingsGroup>

      <SettingsGroup title="Session">
        <SettingsRow icon="log-out-outline" label={signingOut ? 'Signing out' : 'Sign out'} detail="End this session on this device" danger onPress={onSignOut} />
      </SettingsGroup>
    </Screen>
  )
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const theme = useAppTheme()
  return (
    <View style={styles.group}>
      <AppText variant="label" color={theme.colors.textMuted}>{title.toUpperCase()}</AppText>
      <View style={styles.rows}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  header: { paddingTop: 12, gap: 2 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityCopy: { flex: 1, gap: 2 },
  trustLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trustMark: { width: 32, height: 32, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  group: { gap: 8, marginTop: 4 },
  rows: { gap: 0 },
  pushSettings: { paddingVertical: 8 },
})
