import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'

import { PollComposer, emptyPollDraft, type PollDraft } from './PollComposer'

function PollStory({ initial = emptyPollDraft(), disabled = false }: { initial?: PollDraft; disabled?: boolean }) {
  const [value, setValue] = useState(initial)
  return <PollComposer value={value} onChange={setValue} disabled={disabled} />
}

const meta = {
  title: 'Mobile/Organisms/Poll composer',
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const EmptyPoll: Story = {
  render: () => <PollStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: 'Poll question' })).toBeVisible()
    await expect(canvas.getAllByRole('textbox', { name: /Poll option/ })).toHaveLength(2)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Poll question cannot be empty')
  },
}

export const CompletePoll: Story = {
  render: () => (
    <PollStory initial={{ question: 'Which time works better?', options: ['Saturday morning', 'Sunday afternoon'] }} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
    await expect(canvas.getByText('2 of 4 options')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Add poll option' }))
    await expect(canvas.getAllByRole('textbox', { name: /Poll option/ })).toHaveLength(3)
    await userEvent.click(canvas.getByRole('button', { name: 'Remove option 3' }))
    await expect(canvas.getAllByRole('textbox', { name: /Poll option/ })).toHaveLength(2)
  },
}

export const DuplicateOptions: Story = {
  render: () => (
    <PollStory initial={{ question: 'Which time works better?', options: ['Morning', 'morning'] }} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Poll options must be different')
  },
}

export const Disabled: Story = {
  render: () => (
    <PollStory
      initial={{ question: 'Which time works better?', options: ['Saturday morning', 'Sunday afternoon'] }}
      disabled
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Add poll option' })).toBeDisabled()
  },
}
