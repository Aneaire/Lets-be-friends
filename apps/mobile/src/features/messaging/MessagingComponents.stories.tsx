import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { AppText } from '@/design-system/atoms/Typography'
import { CompactComposer } from './CompactComposer'
import { MessageBubble } from './MessageBubble'

const meta = { title: 'Mobile/Organisms/Messaging thread', parameters: { viewport: { defaultViewport: 'mobileSmall' } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const Incoming: Story = { render: () => <MessageBubble direction="incoming" authorName="Alex Rivera" body="Would 2:30 PM work for the online session?" timestamp="2:24 PM" /> }
export const Outgoing: Story = { render: () => <MessageBubble direction="outgoing" body="Yes. I will send the final booking details here." timestamp="2:26 PM" /> }
export const PendingLongContent: Story = { render: () => <MessageBubble direction="outgoing" body="This longer message shows compact wrapping on a small device while retaining a safe reading width." timestamp="2:27 PM" pending /> }
export const AttachmentOnly: Story = { render: () => <MessageBubble direction="incoming" authorName="Alex Rivera" timestamp="2:28 PM" attachments={<Pressable accessibilityRole="link" accessibilityLabel="Open session-notes.pdf" style={{ minHeight: 44, justifyContent: 'center' }}><AppText variant="bodyStrong">session-notes.pdf</AppText></Pressable>} /> }
function ComposerStory() { const [value, setValue] = useState(''); return <View><CompactComposer value={value} onChange={setValue} onSubmit={() => setValue('')} /></View> }
export const ComposerEmptyDisabled: Story = { render: () => <ComposerStory /> }
