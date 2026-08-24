import type { FunctionReturnType } from 'convex/server'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { router, useFocusEffect, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import * as Linking from 'expo-linking'
import { useCallback, useMemo, useRef, useState } from 'react'
import { AppState, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { mobileApi, type ConversationId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { BookingCard } from '@/design-system/organisms/BookingCard'
import { AttachmentMetaRow } from '@/design-system/molecules/AttachmentMetaRow'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { ReportAction } from '@/features/safety/ReportAction'
import { AppText } from '@/design-system/atoms/Typography'
import { CompactComposer } from '@/features/messaging/CompactComposer'
import { BookingMessageShell, ConversationThreadHeader } from '@/features/messaging/ConversationThreadPresentation'
import { MessageBubble } from '@/features/messaging/MessageBubble'
import { bookingDestinationForViewer } from '@/data/bookingActions'
import {
  formatFileSize,
  formatMessageTimestamp,
  messageCounter,
  validateMessageBody,
} from '@/data/messageViewModels'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type Conversation = FunctionReturnType<typeof mobileApi.conversations.conversation>
type Message = FunctionReturnType<typeof mobileApi.conversations.messagePage>['page'][number]

export default function ConversationThreadScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <ThreadState title="Sign in to view this conversation" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <ThreadState title="Conversations need account services" action="Return to Messages" onPress={() => router.replace('/messages')} />
  if (member.status === 'unavailable' || member.status === 'error') return <ThreadState title="This conversation is unavailable" />
  if (member.status !== 'ready') return <ThreadState title="Loading messages" />
  return <ReadyConversationThreadScreen viewerId={String(member.viewer._id)} />
}

function ReadyConversationThreadScreen({ viewerId }: { viewerId: string }) {
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : ''
  const canRead = Boolean(id)
  const conversation = useQuery(mobileApi.conversations.conversation, canRead ? { conversationId: id as ConversationId } : 'skip')
  const messagePage = usePaginatedQuery(
    mobileApi.conversations.messagePage,
    canRead ? { conversationId: id as ConversationId } : 'skip',
    { initialNumItems: 30 },
  )
  const markRead = useMutation(mobileApi.conversations.markRead)
  const sendMessage = useMutation(mobileApi.conversations.sendMessage)
  const relationship = useQuery(mobileApi.safety.relationship, conversation ? { userId: conversation.otherUserId } : 'skip')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  useAppToastMessage(error)
  const sendingRef = useRef(false)
  const listRef = useRef<FlatList<Message>>(null)

  useFocusEffect(useCallback(() => {
    if (!canRead || conversation === undefined || AppState.currentState !== 'active') return
    const markVisibleMessagesRead = () => {
      void markRead({ conversationId: id as ConversationId }).catch(() => undefined)
    }
    markVisibleMessagesRead()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') markVisibleMessagesRead()
    })
    return () => subscription.remove()
  }, [canRead, conversation, id, markRead, messagePage.results.length]))

  async function send() {
    if (sendingRef.current || !canRead || conversation?.otherUserSuspended || relationship?.blocked || relationship?.blockedByOther) return
    const validatedMessage = validateMessageBody(body)
    if (!validatedMessage.ok) {
      setError(validatedMessage.message)
      return
    }

    sendingRef.current = true
    setSending(true)
    setError('')
    try {
      await sendMessage({
        conversationId: id as ConversationId,
        body: validatedMessage.body,
      })
      setBody('')
    } catch {
      setError('Your message could not be sent. Please try again.')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  if (!canRead) return <ThreadState title="This conversation is unavailable" action="Return to Messages" onPress={() => router.replace('/messages')} />
  if (conversation === undefined || messagePage.status === 'LoadingFirstPage') return <ThreadState title="Loading messages" />

  return (
    <ThreadView
      conversation={conversation}
      messages={messagePage.results}
      paginationStatus={messagePage.status}
      loadMore={() => messagePage.loadMore(30)}
      body={body}
      setBody={(value) => { setBody(value); setError('') }}
      sending={sending}
      error={error}
      onSend={() => void send()}
      listRef={listRef}
      viewerId={viewerId}
      contactUnavailable={Boolean(relationship?.blocked || relationship?.blockedByOther)}
    />
  )
}

function ThreadView({ conversation, messages, paginationStatus, loadMore, body, setBody, sending, error, onSend, listRef, viewerId, contactUnavailable }: {
  conversation: Conversation
  messages: Message[]
  paginationStatus: 'CanLoadMore' | 'LoadingMore' | 'Exhausted'
  loadMore: () => void
  body: string
  setBody: (value: string) => void
  sending: boolean
  error: string
  onSend: () => void
  listRef: React.RefObject<FlatList<Message> | null>
  viewerId: string
  contactUnavailable: boolean
}) {
  const theme = useAppTheme()
  const counter = messageCounter(body)
  const suspended = conversation.otherUserSuspended
  const chronologicalMessages = useMemo(() => [...messages].reverse(), [messages])
  const didInitialScroll = useRef(false)

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ConversationThreadHeader
          name={conversation.otherDisplayName}
          imageUrl={conversation.otherProfileImageUrl}
          paused={suspended}
          onBack={goBackOrMessages}
          onSafety={() => router.push({ pathname: '/safety' as never, params: { userId: String(conversation.otherUserId), name: conversation.otherDisplayName } } as never)}
        />
        <FlatList
          ref={listRef}
          data={chronologicalMessages}
          keyExtractor={(message) => message._id}
          renderItem={({ item }) => <MessageItem message={item} otherName={conversation.otherDisplayName} viewerId={viewerId} />}
          contentContainerStyle={[styles.messages, messages.length === 0 && styles.messagesEmpty]}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onContentSizeChange={() => {
            if (didInitialScroll.current) return
            didInitialScroll.current = true
            listRef.current?.scrollToEnd({ animated: false })
          }}
          ListHeaderComponent={paginationStatus === 'CanLoadMore'
            ? <ActionButton label="Load earlier messages" onPress={loadMore} secondary />
            : paginationStatus === 'LoadingMore'
              ? <AppText variant="caption" color={theme.colors.textMuted}>Loading earlier messages.</AppText>
              : null}
          ListEmptyComponent={<View style={styles.empty}><AppText variant="heading">No messages yet</AppText><AppText color={theme.colors.textMuted}>Say hello when you are ready.</AppText></View>}
        />
        {suspended || contactUnavailable ? <View style={[styles.suspended, { borderTopColor: theme.colors.border }]}><AppText color={theme.colors.textMuted}>{contactUnavailable ? 'New contact is stopped for this member connection. Existing messages and booking records remain available.' : 'This conversation is paused and cannot receive new messages.'}</AppText></View> : (
          <View style={[styles.composer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
            <AppText variant="caption" color={theme.colors.textMuted}>Use messages to keep plans and important context together.</AppText>
            <CompactComposer value={body} onChange={setBody} onSubmit={onSend} maxLength={2_100} sending={sending} disabled={counter.overLimit} />
            <AppText variant="caption" color={counter.overLimit ? theme.colors.danger : theme.colors.textMuted}>{counter.count.toLocaleString()}/2,000 characters</AppText>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function MessageItem({ message, otherName, viewerId }: {
  message: Message
  otherName: string
  viewerId: string
}) {
  const theme = useAppTheme()
  const [attachmentError, setAttachmentError] = useState('')

  async function openAttachment(storageId: string) {
    const url = message.attachments.find((attachment) => String(attachment.storageId) === storageId)?.url
    if (!url) return
    setAttachmentError('')
    try {
      await Linking.openURL(url)
    } catch {
      setAttachmentError('This private attachment could not be opened. Please try again.')
    }
  }

  if (message.booking) {
    const destination = bookingDestinationForViewer(viewerId, {
      bookingId: String(message.booking.bookingId),
      memberId: String(message.booking.memberId),
      companionUserId: message.booking.companionUserId ? String(message.booking.companionUserId) : undefined,
    })
    return (
      <BookingMessageShell
        body={message.body}
        category={message.booking.category}
        booking={destination ? (
          <BookingCard
            compact
            booking={{ id: String(message.booking.bookingId), participantName: message.booking.companionDisplayName, category: message.booking.category, mode: message.booking.mode, requestedAt: message.booking.requestedAt, durationMinutes: message.booking.durationMinutes, status: message.booking.status, memberTotalCentavos: message.booking.memberTotalCentavos }}
            onPress={() => router.push(destination)}
          />
        ) : undefined}
        reportAction={!message.sentByViewer ? <ReportAction targetType="message" targetId={String(message._id)} label="Report message" compact /> : undefined}
      />
    )
  }

  return (
    <MessageBubble
      direction={message.sentByViewer ? 'outgoing' : 'incoming'}
      authorName={otherName}
      body={message.body}
      timestamp={formatMessageTimestamp(message.createdAt)}
      attachments={message.attachments.length ? <>
          {message.attachments.map((item, index) => {
            const storageId = String(item.storageId)
            const url = item.url
            return (
              <AttachmentMetaRow
                key={`${storageId}-${index}`}
                name={item.fileName}
                detail={`${formatFileSize(item.size)} · ${url ? 'Open private attachment' : 'Secure link unavailable'}`}
                state={url ? 'default' : 'danger'}
                actionRole="link"
                actionLabel={url ? `Open private attachment ${item.fileName}` : undefined}
                onAction={url ? () => openAttachment(storageId) : undefined}
              />
            )
          })}
        </> : undefined}
      footer={<>
        {attachmentError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{attachmentError}</AppText> : null}
        {!message.sentByViewer ? <ReportAction targetType="message" targetId={String(message._id)} label="Report message" compact /> : null}
      </>}
    />
  )
}

function ThreadState({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <SafeAreaView style={[styles.safe, styles.state, { backgroundColor: theme.colors.background }]}><AppText variant="label" color={theme.colors.socialText}>MESSAGES</AppText><AppText variant="title">{title}</AppText>{action && onPress ? <ActionButton label={action} onPress={onPress} /> : null}</SafeAreaView>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <ThreadState title="This conversation is temporarily unavailable" action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  state: { justifyContent: 'center', padding: 14, gap: 16 },
  messages: { padding: 14, gap: 12 },
  messagesEmpty: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8 },
  composer: { borderTopWidth: 1, padding: 12, gap: 8 },
  suspended: { borderTopWidth: 1, padding: 14 },
})

function goBackOrMessages() {
  if (router.canGoBack()) router.back()
  else router.replace('/messages')
}
