import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { CompanionRecommendationCard, GuidanceFeedCard } from './SocialFeedRecommendations'

const onAction = fn()

const meta = {
  title: 'Mobile/Social/Social feed card',
  parameters: { viewport: { defaultViewport: 'mobileDefault' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const CompanionRecommendation: Story = {
  render: () => (
    <CompanionRecommendationCard
      companion={{
        reason: 'A Companion who matches your interests',
        displayName: 'Alex Rivera', mode: 'both', intro: 'Coffee walks, language practice, and calm company around Quezon City.', strengths: ['Good company', 'Language exchange'], reviewCount: 12, rating: 4.9,
      }}
      onPress={() => onAction('open_companion')}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Alex Rivera')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Open Companion profile for Alex Rivera' }))
    await expect(onAction).toHaveBeenCalledWith('open_companion')
  },
}

export const SafetyGuidance: Story = {
  render: () => (
    <GuidanceFeedCard
      reason="Trust-first reminder"
      title="Keep first meetings public"
      body="Agree on the meeting place and expected end time before an in-person session."
      actionLabel="Explore Companions"
      onPress={() => onAction('open_guidance')}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Explore Companions' }))
    await expect(onAction).toHaveBeenCalledWith('open_guidance')
  },
}
