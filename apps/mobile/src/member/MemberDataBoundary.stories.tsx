import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { AppText } from '@/design-system/atoms/Typography'

import { MemberDataBoundary } from './MemberDataBoundary'
import { useMobileMember } from './MobileMemberContext'

function BoundaryProbe() {
  const member = useMobileMember()
  if (member.status === 'unconfigured') throw new Error('Story-only member provider failure')
  return <AppText accessibilityRole="alert">{member.status === 'error' ? member.message : member.status}</AppText>
}

const meta = {
  title: 'Mobile/Member/Member data boundary',
  component: MemberDataBoundary,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  args: {
    resetKey: 'member-1',
    children: <BoundaryProbe />,
  },
} satisfies Meta<typeof MemberDataBoundary>

export default meta
type Story = StoryObj<typeof meta>

export const ProviderFailure: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Your member profile is temporarily unavailable.',
    )
  },
}
