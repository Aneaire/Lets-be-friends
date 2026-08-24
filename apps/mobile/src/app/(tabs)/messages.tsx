import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { Screen } from '@/design-system/templates/Screen'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'
import { conversationPreview, formatMessageTimestamp } from '@/data/messageViewModels'
import { ConversationListItem } from '@/features/messaging/ConversationListItem'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type Conversation = FunctionReturnType<typeof mobileApi.conversations.list>[number]

export default function MessagesScreen() {
  const member = useMobileMember()
  const conversations = useQuery(mobileApi.conversations.list, member.status === 'ready' ? {} : 'skip')

  if (member.status === 'unconfigured') return <MessagesState title="Messages need account services" detail="Connect your account to load private conversations." />
  if (member.status === 'signed_out') return <MessagesState title="Sign in to view messages" detail="Your private member conversations will appear here." action="Sign in" onPress={() => router.push('/auth')} />
  if (member.status === 'unavailable' || member.status === 'error') return <MessagesState title="Messages are unavailable" detail={member.message} />
  if (member.status !== 'ready' || conversations === undefined) return <MessagesState title="Loading conversations" detail="Connecting to your private messages." loading />
  return <ConversationInbox conversations={conversations} />
}

function ConversationInbox({ conversations }: { conversations: Conversation[] }) {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}><AppText variant="title">Messages</AppText><AppText color={theme.colors.textMuted}>Direct conversations with booking context and live read state.</AppText></View>
      {conversations.length === 0 ? (
        <StateView embedded title="No conversations yet" detail="Message a live Companion from their profile or start with a booking request." actionLabel="Explore Companions" onAction={() => router.push('/explore')} />
      ) : <View style={styles.list}>{conversations.map((conversation) => <ConversationRow key={conversation._id} conversation={conversation} />)}</View>}
    </Screen>
  )
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const preview = `${conversation.lastMessageSentByViewer ? 'You: ' : ''}${conversationPreview(conversation.lastMessageBody, conversation.lastMessageAttachmentCount)}`
  return (
    <ConversationListItem
      name={conversation.otherDisplayName}
      imageUrl={conversation.otherProfileImageUrl}
      preview={preview}
      timeLabel={conversation.lastMessageCreatedAt ? formatMessageTimestamp(conversation.lastMessageCreatedAt) : undefined}
      unreadCount={conversation.unreadCount}
      suspended={conversation.otherUserSuspended}
      onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: String(conversation._id) } })}
    />
  )
}

function MessagesState({ title, detail, action, onPress, loading = false }: { title: string; detail?: string; action?: string; onPress?: () => void; loading?: boolean }) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="MESSAGES" title={title} detail={detail} actionLabel={action} onAction={onPress} loading={loading} /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <MessagesState title="Messages are temporarily unavailable" detail="Private message details are not shown in this error." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  state: { paddingHorizontal: 16 },
  header: { paddingTop: 16, gap: 5, marginBottom: 12 },
  list: { gap: 0 },
})
