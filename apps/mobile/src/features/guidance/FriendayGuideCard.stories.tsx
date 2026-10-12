import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'
import { fn } from 'storybook/test'

import { FriendayGuideCard } from './FriendayGuideCard'

const meta = {
  title: 'Mobile/Guidance/Frienday guide card',
  component: FriendayGuideCard,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof FriendayGuideCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('How a Frienday works')).toBeVisible()
    await expect(canvas.getByText(/Companion decides a start photo/)).toBeVisible()
    await expect(canvas.getByText(/There is no midpoint photo/)).toBeVisible()
  },
}

export const Actions: Story = {
  args: {
    onPressFindCompanion: fn(),
    onPressCreateProfile: fn(),
    onPressSafety: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Find a Companion' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Create Companion profile' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Read safety details' }))
    await expect(args.onPressFindCompanion).toHaveBeenCalledTimes(1)
    await expect(args.onPressCreateProfile).toHaveBeenCalledTimes(1)
    await expect(args.onPressSafety).toHaveBeenCalledTimes(1)
  },
}
