import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { type ProfileViewModel } from './profileViewModel'
import { SignedInProfileContent } from './ProfileContent'

const verifiedMember: ProfileViewModel = {
  name: 'Alex Rivera',
  username: '@alexrivera',
  role: 'Member',
  memberSince: 'Member since March 2026',
  imageUrl: undefined,
  verificationLabel: 'Identity verified',
  verificationDetail: 'Your current identity approval is active for member booking.',
  verificationApproved: true,
  onboardingLabel: 'Welcome guide complete',
  onboardingComplete: true,
}

const needsSetupMember: ProfileViewModel = {
  name: 'Jordan Lee',
  username: '@jordanlee',
  role: 'Companion',
  memberSince: 'Member since May 2026',
  imageUrl: undefined,
  verificationLabel: 'Identity not verified',
  verificationDetail: 'No active identity approval is recorded for this account.',
  verificationApproved: false,
  onboardingLabel: 'Welcome guide needs attention',
  onboardingComplete: false,
}

const meta = {
  title: 'Mobile/Profile/Signed-in profile',
  component: SignedInProfileContent,
  parameters: { viewport: { defaultViewport: 'mobileDefault' } },
  args: {
    profile: verifiedMember,
    bio: 'Coffee enthusiast and weekend hiker.',
    hasCompanionTools: false,
    approvedCompanion: false,
    openingVerification: false,
    signingOut: false,
    pushNotifications: null,
    onEditProfile: fn(),
    onFinishWelcomeGuide: fn(),
    onOpenVerification: fn(),
    onOpenNotificationCenter: fn(),
    onOpenBookings: fn(),
    onOpenWallet: fn(),
    onOpenCompanion: fn(),
    onOpenIncomingBookings: fn(),
    onOpenCompanionFinance: fn(),
    onOpenSafety: fn(),
    onSignOut: fn(),
  },
} satisfies Meta<typeof SignedInProfileContent>

export default meta
type Story = StoryObj<typeof meta>

export const VerifiedMember: Story = {}

export const NeedsSetup: Story = {
  args: {
    profile: needsSetupMember,
    bio: undefined,
  },
}

export const CompanionTools: Story = {
  args: {
    profile: { ...verifiedMember, role: 'Companion' },
    hasCompanionTools: true,
    approvedCompanion: true,
  },
}

export const SigningOut: Story = {
  args: { signingOut: true },
}

export const EditProfileAction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit profile' }))
    await expect(args.onEditProfile).toHaveBeenCalledOnce()
  },
}

export const SignOutRedirects: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Sign out' }))
    await expect(args.onSignOut).toHaveBeenCalledOnce()
  },
}
