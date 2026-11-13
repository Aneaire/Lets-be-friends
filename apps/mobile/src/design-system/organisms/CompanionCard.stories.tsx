import type { Meta, StoryObj } from '@storybook/react-native-web-vite'

import type { DiscoveryCompanionViewModel } from '@/data/companionViewModels'
import { defaultMemberDiscoveryIntro } from '@lets-be-friends/shared'
import { CompanionCard } from './CompanionCard'

const verifiedCompanion: DiscoveryCompanionViewModel = {
  id: 'companion-verified',
  source: 'convex',
  name: 'Arianna Cruz',
  location: 'San Fernando, Pampanga',
  imageUrl: undefined,
  intro: 'Calm coffee walks and relaxed online conversation.',
  strengths: ['Good listener', 'Patient', 'Coffee walks'],
  categories: ['Coffee and meals', 'Open conversation'],
  sessionModes: ['in_person', 'online'],
  rating: 4.9,
  reviewCount: 14,
  rateLabel: '₱650.00 / hour',
  hourlyRateCentavos: 65000,
  distanceLabel: '1.2 km away',
  latitude: 15.03,
  longitude: 120.69,
  verified: true,
  bookable: true,
  viewerBookingEligibility: 'eligible',
  userId: 'user-arianna',
  kind: 'companion',
}

const newCompanion: DiscoveryCompanionViewModel = {
  ...verifiedCompanion,
  id: 'companion-new',
  name: 'Miguel Dizon',
  rating: undefined,
  reviewCount: undefined,
  rateLabel: undefined,
  hourlyRateCentavos: undefined,
  distanceLabel: undefined,
  verified: false,
}

const member: DiscoveryCompanionViewModel = {
  ...verifiedCompanion,
  id: 'member-id',
  kind: 'member',
  verified: true,
  strengths: [],
  categories: [],
  sessionModes: ['online'],
  intro: defaultMemberDiscoveryIntro,
  bookable: true,
}

const meta = {
  title: 'Mobile/Organisms/Companion card',
  component: CompanionCard,
  args: { companion: verifiedCompanion },
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof CompanionCard>

export default meta
type Story = StoryObj<typeof meta>

export const VerifiedCompanion: Story = {
  render: () => <CompanionCard companion={verifiedCompanion} />,
}

export const NewCompanion: Story = {
  render: () => <CompanionCard companion={newCompanion} />,
}

export const MemberCard: Story = {
  render: () => <CompanionCard companion={member} />,
}

export const FollowsRouteToProfile: Story = {
  render: () => <CompanionCard companion={verifiedCompanion} />,
}
