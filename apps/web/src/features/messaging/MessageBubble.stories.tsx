import type { Meta, StoryObj } from '@storybook/react-vite'
import { Paperclip } from 'lucide-react'
import { useState } from 'react'
import { CompactComposer } from './CompactComposer'
import { MessageBubble } from './MessageBubble'

const meta = { title: 'Web/Organisms/Messaging thread', parameters: { viewport: { defaultViewport: 'mobileSmall' } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Incoming: Story = { render: () => <div className="ds-story-thread"><MessageBubble direction="incoming" body="Would 2:30 PM work for the online session?" timestamp="2:24 PM" /></div> }
export const Outgoing: Story = { render: () => <div className="ds-story-thread"><MessageBubble direction="outgoing" body="Yes. I will send the final booking details here." timestamp="2:26 PM" status="sent" /></div> }
export const PendingLongContent: Story = { render: () => <div className="ds-story-thread"><MessageBubble direction="outgoing" body="This is a longer message that shows how the bubble wraps on a compact 320 pixel screen without making the text difficult to scan." timestamp="2:27 PM" status="sending" pending /></div> }
export const AttachmentOnly: Story = { render: () => <div className="ds-story-thread"><MessageBubble direction="incoming" timestamp="2:28 PM" attachments={<button className="btn btn-neutral btn-sm"><Paperclip size={15} />Open session-notes.pdf</button>} /></div> }
function ComposerStory() { const [value, setValue] = useState(''); return <CompactComposer value={value} onChange={setValue} onSubmit={() => setValue('')} /> }
export const ComposerEmptyDisabled: Story = { render: () => <div className="ds-story-thread"><ComposerStory /></div> }
