import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { privacyDocument, termsDocument } from '@lets-be-friends/shared'

import { AppHeader } from '@/design-system/molecules/AppHeader'
import { SettingsRow } from '@/design-system/molecules/SettingsRow'
import { Screen } from '@/design-system/templates/Screen'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

export function SettingsContent({
  pushNotifications,
  appearanceSettings,
  verificationValue,
  verificationDetail,
  verificationAction,
  openingVerification,
  signingOut,
  signOutError,
  showWithdrawals,
  showIncomingBookings,
  showCompanionFinance,
  onEditProfile,
  onFinishWelcomeGuide,
  onOpenVerification,
  onOpenNotificationCenter,
  onOpenMyPosts,
  onOpenBookings,
  onOpenWallet,
  onOpenWithdrawals,
  onOpenCompanion,
  onOpenIncomingBookings,
  onOpenCompanionFinance,
  onOpenSafety,
  onOpenTerms,
  onOpenPrivacy,
  onSignOut,
  onBack,
}: {
  pushNotifications?: ReactNode
  appearanceSettings?: ReactNode
  verificationValue?: string
  verificationDetail: string
  verificationAction: 'verify' | 'continue' | 'retry' | 'none'
  openingVerification: boolean
  signingOut: boolean
  signOutError: boolean
  showWithdrawals: boolean
  showIncomingBookings: boolean
  showCompanionFinance: boolean
  onEditProfile: () => void
  onFinishWelcomeGuide: () => void
  onOpenVerification: () => void
  onOpenNotificationCenter: () => void
  onOpenMyPosts: () => void
  onOpenBookings: () => void
  onOpenWallet: () => void
  onOpenWithdrawals: () => void
  onOpenCompanion: () => void
  onOpenIncomingBookings: () => void
  onOpenCompanionFinance: () => void
  onOpenSafety: () => void
  onOpenTerms: () => void
  onOpenPrivacy: () => void
  onSignOut: () => void
  onBack: () => void
}) {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Settings" subtitle="Notifications, appearance, and account" back onBack={onBack} />
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.selfText}>ACCOUNT SETTINGS</AppText>
        <AppText variant="title">Tune your account</AppText>
        <AppText color={theme.colors.textMuted}>Notification, appearance, verification, booking, wallet, Companion, safety, and session controls.</AppText>
      </View>

      <SettingsGroup title="Account">
        <SettingsRow icon="person-outline" label="Edit profile" detail="Update your display name, bio, and profile photo" onPress={onEditProfile} />
        <SettingsRow icon="sparkles-outline" label="Welcome guide" detail="Finish setup or review your choices" onPress={onFinishWelcomeGuide} />
        <SettingsRow
          icon={verificationAction === 'none' ? 'shield-checkmark' : 'shield-checkmark-outline'}
          label={openingVerification ? 'Opening identity verification' : 'Identity verification'}
          detail={verificationDetail}
          value={verificationValue}
          onPress={onOpenVerification}
        />
        <SettingsRow icon="notifications-outline" label="Notification center" detail="Booking, social, account, and safety updates" onPress={onOpenNotificationCenter} />
        {pushNotifications ? <View style={styles.embedded}>{pushNotifications}</View> : null}
        {appearanceSettings ? <View style={styles.embedded}>{appearanceSettings}</View> : null}
      </SettingsGroup>

      <SettingsGroup title="Your content">
        <SettingsRow icon="document-text-outline" label="My posts and reviews" detail="View your public posts and Companion reviews" onPress={onOpenMyPosts} />
      </SettingsGroup>

      <SettingsGroup title="Bookings and money">
        <SettingsRow icon="calendar-outline" label="Bookings" detail="Upcoming, requests, and past experiences" onPress={onOpenBookings} />
        <SettingsRow icon="wallet-outline" label="Booking wallet" detail="Available, reserved, and pending member balance" onPress={onOpenWallet} />
        {showWithdrawals ? <SettingsRow icon="cash-outline" label="Withdraw funds" detail="Move available wallet funds to your verified payout account" onPress={onOpenWithdrawals} /> : null}
      </SettingsGroup>

      <SettingsGroup title="Companion">
        <SettingsRow icon="people-outline" label="Companion tools" detail="What you offer, your public profile, Strengths, and rate" onPress={onOpenCompanion} />
        {showIncomingBookings ? <SettingsRow icon="mail-open-outline" label="Incoming bookings" detail="Review and respond to member requests" onPress={onOpenIncomingBookings} /> : null}
        {showCompanionFinance ? <SettingsRow icon="stats-chart-outline" label="Companion finance" detail="Earnings, fees, obligations, and history" onPress={onOpenCompanionFinance} /> : null}
      </SettingsGroup>

      <SettingsGroup title="Safety and support">
        <SettingsRow icon="shield-outline" label="Safety Center" detail="Meeting guidance, reports, blocked members, and muted members" onPress={onOpenSafety} />
      </SettingsGroup>

      <SettingsGroup title="Legal and privacy">
        <SettingsRow icon="document-text-outline" label={termsDocument.title} detail="Rules for using the service, bookings, and Companion conduct" onPress={onOpenTerms} />
        <SettingsRow icon="lock-closed-outline" label={privacyDocument.title} detail="What we collect, why we use it, and how long we keep it" onPress={onOpenPrivacy} />
      </SettingsGroup>

      <SettingsGroup title="Session">
        <SettingsRow icon="log-out-outline" label={signingOut ? 'Signing out' : 'Sign out'} detail="End this session on this device" danger onPress={signingOut ? undefined : onSignOut} />
        {signOutError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>Sign out could not be completed. Please try again.</AppText> : null}
      </SettingsGroup>
    </Screen>
  )
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const theme = useAppTheme()
  return (
    <View style={styles.group}>
      <AppText variant="label" color={theme.colors.textMuted}>{title.toUpperCase()}</AppText>
      <View>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  header: { paddingTop: 12, gap: 4 },
  group: { gap: 8, marginTop: 4 },
  embedded: { paddingVertical: 8 },
})
