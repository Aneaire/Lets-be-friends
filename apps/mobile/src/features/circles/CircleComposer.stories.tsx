import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { expect, within } from 'storybook/test'

import { emptyPollDraft, type PollDraft } from '@/features/social/PollComposer'

import { CircleComposerView } from './CircleComposer'

function ApprovalComposer() {
  const [body, setBody] = useState('')
  const [pollDraft, setPollDraft] = useState<PollDraft>(emptyPollDraft)
  return (
    <CircleComposerView
      body={body}
      expanded
      busy={false}
      error=""
      canModerate
      announcement={false}
      approvalNotice
      submittedNotice={false}
      media={[]}
      remainingUploads={5}
      mentionSuggestions={[]}
      pollOpen={false}
      pollDraft={pollDraft}
      onPollChange={setPollDraft}
      onTogglePoll={() => undefined}
      onExpand={() => undefined}
      onBodyChange={setBody}
      onCaretChange={() => undefined}
      onChooseMedia={() => undefined}
      onRemoveMedia={() => undefined}
      onSelectMention={() => undefined}
      onAnnouncementChange={() => undefined}
      onPublish={() => undefined}
    />
  )
}

function PollComposerStory() {
  const [body, setBody] = useState('')
  const [pollDraft, setPollDraft] = useState<PollDraft>({ question: 'Which morning works?', options: ['Saturday', 'Sunday'] })
  return (
    <CircleComposerView
      body={body}
      expanded
      busy={false}
      error=""
      canModerate
      announcement={false}
      approvalNotice={false}
      submittedNotice={false}
      media={[]}
      remainingUploads={5}
      mentionSuggestions={[]}
      pollOpen
      pollDraft={pollDraft}
      onPollChange={setPollDraft}
      onTogglePoll={() => undefined}
      onExpand={() => undefined}
      onBodyChange={setBody}
      onCaretChange={() => undefined}
      onChooseMedia={() => undefined}
      onRemoveMedia={() => undefined}
      onSelectMention={() => undefined}
      onAnnouncementChange={() => undefined}
      onPublish={() => undefined}
    />
  )
}

const meta = {
  title: 'Mobile/Circles/Discussion composer',
  component: ApprovalComposer,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof ApprovalComposer>

export default meta
type Story = StoryObj<typeof meta>

export const ApprovalNotice: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Start a discussion')).toBeVisible()
    await expect(canvas.getByText('New posts need leader approval before they appear in the Circle.')).toBeVisible()
    await expect(canvas.getByText('Post as an announcement')).toBeVisible()
  },
}

export const TextOnlyPoll: Story = {
  render: () => <PollComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Start a discussion')).toBeVisible()
    await expect(canvas.getByLabelText('Poll question')).toBeVisible()
    await expect(canvas.getByLabelText('Poll option 1')).toBeVisible()
  },
}
