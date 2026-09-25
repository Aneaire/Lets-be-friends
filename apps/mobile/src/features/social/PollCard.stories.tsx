import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test'

import { PollCard, type MobilePoll } from './PollCard'

const vote = fn(async () => undefined)

const openPoll: MobilePoll = {
  question: 'Which time works better for a weekend session?',
  totalVotes: 9,
  closed: false,
  options: [
    { id: 'morning', label: 'Saturday morning', voteCount: 6, percentage: 66.7 },
    { id: 'afternoon', label: 'Sunday afternoon', voteCount: 3, percentage: 33.3 },
  ],
}

const meta = {
  title: 'Mobile/Organisms/Poll card',
  component: PollCard,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof PollCard>

export default meta
type Story = StoryObj<typeof meta>

export const OpenPoll: Story = {
  args: { poll: openPoll, onVote: vote },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Which time works better for a weekend session?')).toBeVisible()
    const voteButton = canvas.getByRole('button', { name: 'Vote' })
    await expect(voteButton).toBeDisabled()
    await userEvent.click(canvas.getByRole('radio', { name: /Saturday morning/ }))
    await expect(voteButton).toBeEnabled()
    await userEvent.click(voteButton)
    await expect(vote).toHaveBeenCalledWith('morning')
  },
}

export const ResultsAfterVoting: Story = {
  args: {
    poll: { ...openPoll, votedOptionId: 'morning' },
    onVote: vote,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Your vote is in. Results stay live.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Vote' })).not.toBeInTheDocument()
    await expect(canvas.getByRole('radio', { name: /Saturday morning/ })).toHaveAttribute('aria-checked', 'true')
  },
}

export const ClosedPoll: Story = {
  args: { poll: { ...openPoll, closed: true }, onVote: vote },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('This poll is closed.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Vote' })).not.toBeInTheDocument()
  },
}

export const SignedOutReadOnly: Story = {
  args: { poll: openPoll, disabled: true, onVote: vote },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Vote' })).not.toBeInTheDocument()
    const firstOption = canvas.getByRole('radio', { name: /Saturday morning/ })
    await expect(firstOption).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(firstOption)
    await expect(firstOption).toHaveAttribute('aria-checked', 'false')
  },
}
