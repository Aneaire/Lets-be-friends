import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { Avatar } from '@/components/Avatar'
import { Screen } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import { getFriendHost } from '@/data/hosts'
import { messagePreview } from '@/data/member'
import { conversationPreview, formatMessageTimestamp } from '@/data/messageViewModels'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type Conversation = FunctionReturnType<typeof mobileApi.conversations.list>[number]

export default function MessagesScreen() {
  const member = useMobileMember()
  const conversations = useQuery(mobileApi.conversations.list, member.status === 'ready' ? {} : 'skip')

  if (member.status === 'demo') return <DemoMessages />
  if (member.status === 'signed_out') return <MessagesState title="Sign in to continue the conversation" detail="Your real booking conversations will appear here after sign-in." action="Sign in" onPress={() => router.push('/auth')} />
  if (member.status === 'unavailable' || member.status === 'error') return <MessagesState title="Messages are unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready' || conversations === undefined) return <MessagesState title="Loading conversations" detail="Connecting to your private messages." />

  return <ConversationInbox conversations={conversations} />
}

function ConversationInbox({ conversations }: { conversations: Conversation[] }) {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.social}>MESSAGES</AppText>
        <AppText variant="display">Plans, with context.</AppText>
        <AppText color={theme.colors.textMuted}>Private conversations and booking updates appear in real time.</AppText>
      </View>
      {conversations.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <AppText variant="heading">No conversations yet</AppText>
          <AppText color={theme.colors.textMuted}>A conversation will appear after you send a booking request.</AppText>
          <ActionButton label="Explore Friend Hosts" onPress={() => router.push('/explore')} secondary />
        </View>
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
      style={({ pressed }) => [styles.preview, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }, pressed && styles.pressed]}>
      <Avatar uri={conversation.otherProfileImageUrl ?? undefined} name={conversation.otherDisplayName} size={54} />
      <View style={styles.previewCopy}>
        <View style={styles.nameRow}>
          <AppText variant="bodyStrong">{conversation.otherDisplayName}</AppText>
          {conversation.lastMessageCreatedAt ? <AppText variant="caption" color={theme.colors.textMuted}>{formatMessageTimestamp(conversation.lastMessageCreatedAt)}</AppText> : null}
        </View>
        <AppText numberOfLines={2} color={conversation.unreadCount ? theme.colors.text : theme.colors.textMuted}>{conversation.lastMessageSentByViewer ? 'You: ' : ''}{preview}</AppText>
        {conversation.otherUserSuspended ? <AppText variant="caption" color={theme.colors.social}>Conversation paused</AppText> : null}
      </View>
      {conversation.unreadCount > 0 ? <View accessibilityLabel={`${conversation.unreadCount} unread messages`} style={[styles.unread, { backgroundColor: theme.colors.social }]}><AppText variant="caption" color={theme.colors.accentText}>{conversation.unreadCount}</AppText></View> : null}
    </Pressable>
  )
}

function DemoMessages() {
  const theme = useAppTheme()
  const host = getFriendHost(messagePreview.hostId)
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.social}>MESSAGES</AppText>
        <AppText variant="display">Plans, with context.</AppText>
        <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: theme.colors.socialSoft, borderColor: theme.colors.social }]}>
          <AppText variant="caption">Demo messages only. No message can be sent from this build.</AppText>
        </View>
      </View>
      {host ? <Pressable accessibilityRole="button" accessibilityLabel="Open example Friend Host profile" onPress={() => router.push({ pathname: '/host/[id]', params: { id: host.id, source: 'local_demo' } })} style={[styles.preview, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}><Avatar uri={host.imageUrl} name={host.name} size={54} /><View style={styles.previewCopy}><AppText variant="bodyStrong">{messagePreview.hostName}</AppText><AppText>{messagePreview.preview}</AppText><AppText variant="caption" color={theme.colors.social}>Example conversation</AppText></View></Pressable> : null}
    </Screen>
  )
}

function MessagesState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.social}>MESSAGES</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} /> : null}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <MessagesState title="Messages are temporarily unavailable" detail="Please try again. Private message details are not shown in this error." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48 },
  header: { paddingTop: 24, gap: 14, marginBottom: 24 },
  notice: { borderWidth: 1, borderRadius: 16, padding: 14 },
  list: { gap: 12 },
  preview: { borderWidth: 1, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewCopy: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  unread: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.74 },
  empty: { borderWidth: 1, borderRadius: 24, padding: 22, gap: 12 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
})
