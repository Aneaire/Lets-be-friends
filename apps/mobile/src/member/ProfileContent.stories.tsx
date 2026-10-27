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

const longContentArgs = {
  ...companionArgs,
  displayName: 'Alexandra Rivera Santos Dela Cruz Mendoza',
  username: '@alexandra-rivera-santos-with-a-very-long-handle',
  bio: 'Weekend hiker, museum companion, and errand helper. I enjoy long city walks, quiet galleries, and helping with everyday tasks across Cebu. Happy to plan around mobility needs and public places.',
  interests: ['Hiking across Cebu City hills', 'Museums and quiet galleries', 'Everyday errands and groceries', 'Language exchange over coffee'],
  memberSince: 'Member since March 2026',
  companion: {
    ...companionArgs.companion!,
    intro: 'I can join a museum visit, help with everyday errands, or keep company on a relaxed city walk planned around your pace and comfort.',
    categories: ['Museums and galleries with step-free access', 'Grocery errands and pharmacy pickups', 'Relaxed city walks and park visits'],
    strengths: ['Patient conversation', 'Reliable timekeeping', 'Careful planning around mobility needs'],
    boundaries: ['Public places only', 'Daytime plans only', 'No heavy lifting beyond one grocery bag'],
  },
}

export const BioRenderedOnce: Story = {
  args: { ...baseArgs, bio: 'A short bio that appears only in About.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('A short bio that appears only in About.')).toHaveLength(1)
    await expect(canvas.getByText('About')).toBeInTheDocument()
    await expect(canvas.queryByText('What other members can see about you.')).not.toBeInTheDocument()
    await expect(canvas.queryByText('BIO')).not.toBeInTheDocument()
    await expect(canvas.queryByText('Identity and Companion profile verified.')).not.toBeInTheDocument()
  },
}

export const HierarchyTypeScale: Story = {
  args: baseArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const name = canvas.getByText(baseArgs.displayName)
    const section = canvas.getByText('About')
    const body = canvas.getByText(baseArgs.bio)
    const meta = canvas.getByText(baseArgs.username)
    await expect(getComputedStyle(name).fontSize).toBe('24px')
    await expect(getComputedStyle(name).lineHeight).toBe('29px')
    await expect(getComputedStyle(section).fontSize).toBe('18px')
    await expect(getComputedStyle(section).lineHeight).toBe('24px')
    await expect(getComputedStyle(body).fontSize).toBe('15px')
    await expect(getComputedStyle(body).lineHeight).toBe('22px')
    await expect(getComputedStyle(meta).fontSize).toBe('13px')
    await expect(getComputedStyle(meta).lineHeight).toBe('18px')
  },
}

export const LongContentNarrow: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: longContentArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(longContentArgs.displayName)).toBeInTheDocument()
    await expect(canvas.getByText(longContentArgs.bio)).toBeInTheDocument()
    for (const interest of longContentArgs.interests) {
      await expect(canvas.getByText(interest)).toBeInTheDocument()
    }
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1)
  },
}

export const NormalNameSingleLineNarrow: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: baseArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const name = canvas.getByText(baseArgs.displayName)
    const settings = canvas.getByRole('button', { name: 'Open settings' })
    await expect(name.clientHeight).toBeLessThanOrEqual(36)
    await expect(name.clientWidth).toBeGreaterThanOrEqual(200)
    await expect(settings.getBoundingClientRect().bottom).toBeLessThanOrEqual(name.getBoundingClientRect().top)
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1)
  },
}

export const LongNameWrapsFullWidth: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: longContentArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const name = canvas.getByText(longContentArgs.displayName)
    const settings = canvas.getByRole('button', { name: 'Open settings' })
    await expect(name.clientHeight).toBeGreaterThan(36)
    await expect(name.clientWidth).toBeGreaterThanOrEqual(200)
    await expect(settings.getBoundingClientRect().bottom).toBeLessThanOrEqual(name.getBoundingClientRect().top)
    for (const interest of longContentArgs.interests) {
      await expect(canvas.getByText(interest)).toBeInTheDocument()
    }
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1)
  },
}

export const LongContentDark: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false }, theme: 'dark' },
  args: longContentArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(longContentArgs.displayName)).toBeInTheDocument()
    await expect(canvas.getByText(longContentArgs.bio)).toBeInTheDocument()
    for (const interest of longContentArgs.interests) {
      await expect(canvas.getByText(interest)).toBeInTheDocument()
    }
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1)
  },
}
export const HeaderActionsAndVerification: Story = {
  args: { ...companionArgs, fullyVerified: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const settings = canvas.getByRole('button', { name: 'Open settings' })
    const actions = canvas.getByRole('button', { name: 'Profile actions' })
    await expect(settings).toBeInTheDocument()
    await expect(actions).toBeInTheDocument()
    await expect(settings.clientWidth).toBeGreaterThanOrEqual(44)
    await expect(settings.clientHeight).toBeGreaterThanOrEqual(44)
    await expect(actions.clientWidth).toBeGreaterThanOrEqual(44)
    await expect(actions.clientHeight).toBeGreaterThanOrEqual(44)
    await expect(canvas.getByRole('img', { name: 'Identity and Companion profile verified' })).toBeInTheDocument()
    await expect(canvas.queryByText('Identity and Companion profile verified.')).not.toBeInTheDocument()
  },
}
