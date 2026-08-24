import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConversationListItemContent } from './ConversationListItem'

const meta = {
  title: 'Web/Organisms/Conversation list item',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function ConversationStory(props: Parameters<typeof ConversationListItemContent>[0] & { selected?: boolean }) {
  const { selected, ...content } = props
  return (
    <div className="conversation-rail" style={{ maxWidth: 320 }}>
      <a href="#conversation" className="conversation-rail-link" aria-current={selected ? 'page' : undefined}>
        <ConversationListItemContent {...content} />
      </a>
    </div>
  )
}

export const Unread: Story = {
  render: () => (
    <ConversationStory
      name="Alex Rivera"
      preview="Would Saturday afternoon work for the online session?"
      timeLabel="2:24 PM"
      dateTime="2026-08-23T14:24:00.000Z"
      unreadCount={3}
      selected
    />
  ),
}

export const Read: Story = {
  render: () => <ConversationStory name="Morgan Lee" preview="You: I sent the booking details." timeLabel="Yesterday" />,
}

export const AttachmentAndLongName: Story = {
  render: () => (
    <ConversationStory
      name="A very long member display name that must remain readable"
      preview="Sent 4 files"
      timeLabel="Aug 21 · 11:08 AM"
      unreadCount={128}
    />
  ),
}

export const SuspendedMember: Story = {
  render: () => <ConversationStory name="Jordan Santos" preview="Last message content" suspended timeLabel="Aug 18" />,
}
