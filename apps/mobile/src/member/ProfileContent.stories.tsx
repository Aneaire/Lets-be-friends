import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { SignedInProfileContent } from './ProfileContent'

const baseArgs = {
  displayName: 'Alex Rivera',
  username: '@alexrivera',
  bio: 'Coffee enthusiast and weekend hiker.',
  imageUrl: undefined,
  interests: ['Hiking', 'Languages'],
  memberSince: 'Member since March 2026',
  roleLabel: 'Member',
  verificationLabel: 'Identity verified',
  verificationDetail: 'Your current identity approval is active for member booking.',
  verificationApproved: true,
  verificationAction: 'none' as const,
  openingVerification: false,
  discoveryArea: '14.50, 121.00',
  companion: null,
  hasApplication: false,
  fullyVerified: false,
  posts: [],
  reviews: [],
  reviewsStatus: 'needs_companion' as const,
  rating: null,
  reviewCount: null,
  onEditProfile: fn(),
  onOpenBookings: fn(),
  onOpenCompanion: fn(),
  onOpenVerification: fn(),
  onCreateBooking: fn(),
  onOpenPublicProfile: fn(),
  onOpenSettings: fn(),
}

const companionArgs = {
  ...baseArgs,
  roleLabel: 'Companion',
  hasApplication: true,
  fullyVerified: true,
  reviewsStatus: 'empty' as const,
  rating: 4.8,
  reviewCount: 12,
  companion: {
    status: 'approved',
    intro: 'I can join a museum visit or help with everyday errands.',
    categories: ['Museums', 'Errands'],
    strengths: ['Conversation', 'Reliability'],
    boundaries: ['Public places only'],
    mode: 'both',
    city: 'Cebu City',
    hourlyRateCentavos: 50000,
    rating: 4.8,
    reviewCount: 12,
    publicProfileId: 'cp-1',
  },
}

const meta = {
  title: 'Mobile/Profile/Signed-in profile',
  component: SignedInProfileContent,
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: baseArgs,
} satisfies Meta<typeof SignedInProfileContent>

export default meta
type Story = StoryObj<typeof meta>

export const VerifiedMember: Story = {}

export const VerifiedMemberDark: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false }, theme: 'dark' },
}

export const NeedsVerification: Story = {
  args: {
    verificationApproved: false,
    verificationLabel: 'Identity not verified',
    verificationDetail: 'No active identity approval is recorded for this account.',
    verificationAction: 'verify',
  },
}

export const CompanionPublic: Story = {
  args: companionArgs,
}

export const CompanionPublicDark: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false }, theme: 'dark' },
  args: companionArgs,
}

export const CompanionPendingIdentity: Story = {
  args: {
    ...companionArgs,
    fullyVerified: false,
    companion: { ...companionArgs.companion!, status: 'approved', publicProfileId: null },
  },
}

export const Narrow320: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: companionArgs,
}

export const LoadingReviews: Story = {
  args: { ...companionArgs, reviewsStatus: 'loading' as const, reviews: undefined },
}

export const ProfileActionsMenu: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    // The actions menu renders through a native modal portal, so menu items
    // live outside the story canvas in the same document body.
    const documentRoot = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: 'Profile actions' }))
    await userEvent.click(await documentRoot.findByRole('button', { name: 'Your bookings' }))
    await expect(args.onOpenBookings).toHaveBeenCalledOnce()
  },
}

export const ReviewsTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: 'Reviews' }))
    await expect(canvas.getByText('Reviews appear after you become a Companion')).toBeInTheDocument()
  },
}

export const CompanionActions: Story = {
  args: companionArgs,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'View public profile' }))
    await expect(args.onOpenPublicProfile).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Companion profile' }))
    await expect(args.onOpenCompanion).toHaveBeenCalled()
  },
}

export const OpenSettings: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open settings' }))
    await expect(args.onOpenSettings).toHaveBeenCalledOnce()
  },
}
