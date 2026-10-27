import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { NotificationPreferenceValues } from '@/notifications/notificationPreferences'

import { NotificationPreferencesPresentation } from './NotificationPreferencesPresentation'
import { SettingsContent } from './SettingsContent'

const baseArgs = {
  pushNotifications: null,
  notificationPreferences: null,
  appearanceSettings: null,
  verificationValue: 'Approved',
  verificationDetail: 'Your current identity approval is active for member booking.',
  verificationAction: 'none' as const,
  openingVerification: false,
  signingOut: false,
  signOutError: false,
  showWithdrawals: false,
  showIncomingBookings: false,
  showCompanionFinance: false,
  onEditProfile: fn(),
  onFinishWelcomeGuide: fn(),
  onOpenVerification: fn(),
  onOpenNotificationCenter: fn(),
  onOpenMyPosts: fn(),
  onOpenBookings: fn(),
  onOpenWallet: fn(),
  onOpenWithdrawals: fn(),
  onOpenCompanion: fn(),
  onOpenIncomingBookings: fn(),
  onOpenCompanionFinance: fn(),
  onOpenSafety: fn(),
  onOpenTerms: fn(),
  onOpenPrivacy: fn(),
  onSignOut: fn(),
  onBack: fn(),
}

const meta = {
  title: 'Mobile/Settings/Settings screen',
  component: SettingsContent,
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: baseArgs,
} satisfies Meta<typeof SettingsContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const DefaultDark: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false }, theme: 'dark' },
}

export const CompanionReady: Story = {
  args: { ...baseArgs, showWithdrawals: true, showIncomingBookings: true, showCompanionFinance: true },
}

export const CompanionReadyDark: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false }, theme: 'dark' },
  args: { ...baseArgs, showWithdrawals: true, showIncomingBookings: true, showCompanionFinance: true },
}

export const Narrow320: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: { ...baseArgs, showWithdrawals: true, showIncomingBookings: true, showCompanionFinance: true },
}

export const NeedsVerification: Story = {
  args: {
    verificationValue: undefined,
    verificationDetail: 'No active identity approval is recorded for this account.',
    verificationAction: 'verify' as const,
  },
}

export const OpeningVerification: Story = {
  args: {
    verificationValue: undefined,
    verificationDetail: 'No active identity approval is recorded for this account.',
    verificationAction: 'verify' as const,
    openingVerification: true,
  },
}

export const SignOutError: Story = {
  args: { signOutError: true },
}

export const SettingsActions: Story = {
  args: {
    verificationValue: undefined,
    verificationDetail: 'No active identity approval is recorded for this account.',
    verificationAction: 'verify' as const,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Identity verification' }))
    await expect(args.onOpenVerification).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Sign out' }))
    await expect(args.onSignOut).toHaveBeenCalledOnce()
  },
}

const notificationPreferenceValues: NotificationPreferenceValues = {
  socialReactions: true,
  socialComments: true,
  socialFollows: true,
  circleActivity: false,
  quietHoursEnabled: true,
  quietHoursStartMinute: 1320,
  quietHoursEndMinute: 420,
  timeZone: 'Asia/Manila',
  digestEnabled: false,
  digestHourMinute: 1080,
}

const toggleNotificationPreference = fn()

const notificationPreferencesNode = (
  <NotificationPreferencesPresentation
    values={notificationPreferenceValues}
    onToggle={toggleNotificationPreference}
    onSelectTime={fn()}
  />
)

export const NotificationPreferencesGroup: Story = {
  args: {
    ...baseArgs,
    notificationPreferences: notificationPreferencesNode,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('NOTIFICATIONS')).toBeVisible()
    await expect(canvas.getByRole('switch', { name: 'Circle activity' })).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(canvas.getByRole('switch', { name: 'Circle activity' }))
    await expect(toggleNotificationPreference).toHaveBeenCalledWith('circleActivity')
    await expect(canvas.getByRole('button', { name: 'Quiet hours start, 10:00 PM' })).toBeVisible()
  },
}

export const NotificationPreferencesGroupDark: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false }, theme: 'dark' },
  args: {
    ...baseArgs,
    notificationPreferences: notificationPreferencesNode,
  },
}
