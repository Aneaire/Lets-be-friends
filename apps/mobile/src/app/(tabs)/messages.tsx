import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { Avatar } from '@/components/Avatar'
import { Screen } from '@/components/Screen'
import { StateView } from '@/components/StateView'
import { AppText } from '@/components/Typography'
import { conversationPreview, formatMessageTimestamp } from '@/data/messageViewModels'
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
  const theme = useAppTheme()
  const preview = conversationPreview(conversation.lastMessageBody, conversation.lastMessageAttachmentCount)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${conversation.otherDisplayName}${conversation.unreadCount ? `, ${conversation.unreadCount} unread` : ''}`}
      onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: String(conversation._id) } })}
      style={({ pressed }) => [styles.preview, { borderBottomColor: theme.colors.border }, pressed && styles.pressed]}>
      <Avatar uri={conversation.otherProfileImageUrl ?? undefined} name={conversation.otherDisplayName} size={52} />
      <View style={styles.previewCopy}>
        <View style={styles.nameRow}><AppText variant="bodyStrong" numberOfLines={1}>{conversation.otherDisplayName}</AppText>{conversation.lastMessageCreatedAt ? <AppText variant="caption" color={theme.colors.textMuted}>{formatMessageTimestamp(conversation.lastMessageCreatedAt)}</AppText> : null}</View>
        <AppText numberOfLines={2} color={conversation.unreadCount ? theme.colors.text : theme.colors.textMuted}>{conversation.lastMessageSentByViewer ? 'You: ' : ''}{preview}</AppText>
        <AppText variant="caption" color={conversation.otherUserSuspended ? theme.colors.danger : theme.colors.textMuted}>{conversation.otherUserSuspended ? 'Conversation paused for safety' : 'Private member conversation'}</AppText>
      </View>
      {conversation.unreadCount > 0 ? <View accessibilityLabel={`${conversation.unreadCount} unread messages`} style={[styles.unread, { backgroundColor: theme.colors.social }]}><AppText variant="caption" color={theme.colors.accentText}>{conversation.unreadCount}</AppText></View> : null}
    </Pressable>
  )
}

function MessagesState({ title, detail, action, onPress, loading = false }: { title: string; detail?: string; action?: string; onPress?: () => void; loading?: boolean }) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="MESSAGES" title={title} detail={detail} actionLabel={action} onAction={onPress} loading={loading} /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <MessagesState title="Messages are temporarily unavailable" detail="Private message details are not shown in this error." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  state: { paddingHorizontal: 16 },
  header: { paddingTop: 16, gap: 5, marginBottom: 12 },
  list: { gap: 0 },
  preview: { minHeight: 82, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewCopy: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  unread: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.62 },
})
