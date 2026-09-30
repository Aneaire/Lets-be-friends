import type { FunctionReturnType } from 'convex/server'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { router, useFocusEffect, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as Linking from 'expo-linking'
import { useCallback, useMemo, useRef, useState } from 'react'
import { AppState, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { mobileApi, type ConversationId, type DirectMessageUploadId, type StorageId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { BookingCard } from '@/design-system/organisms/BookingCard'
import { AttachmentMetaRow } from '@/design-system/molecules/AttachmentMetaRow'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { ReportAction } from '@/features/safety/ReportAction'
import { AppText } from '@/design-system/atoms/Typography'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { keyboardAvoidingBehavior } from '@/design-system/templates/Screen'
import { CompactComposer } from '@/features/messaging/CompactComposer'
import { BookingMessageShell, ConversationThreadHeader } from '@/features/messaging/ConversationThreadPresentation'
import { MessageBubble } from '@/features/messaging/MessageBubble'
import { bookingDestinationForViewer } from '@/data/bookingActions'
import {
  attachmentSelectionError,
  canSubmitConversationMessage,
  chatAttachmentKind,
  describeChatAttachment,
  MAX_CHAT_ATTACHMENTS,
  needsCompressionBeforeSend,
  normalizeAttachmentFileName,
  validateChatAttachment,
} from '@/data/chatAttachments'
import { prepareChatUpload, uploadChatAttachment } from '@/features/messaging/chatAttachmentUpload'
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
  if (member.status !== 'ready') return <PageSkeleton variant="conversation" />
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
  const generateUpload = useMutation(mobileApi.conversations.generateAttachmentUploadUrl)
  const registerUpload = useMutation(mobileApi.conversations.registerAttachmentUpload)
  const discardUpload = useMutation(mobileApi.conversations.discardAttachmentUpload)
  const relationship = useQuery(mobileApi.safety.relationship, conversation ? { userId: conversation.otherUserId } : 'skip')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [picking, setPicking] = useState(false)
  const [attachments, setAttachments] = useState<PendingChatAttachment[]>([])
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

  const readyAttachments = attachments.filter((attachment) => attachment.status === 'ready')
  const hasAttachmentErrors = attachments.some((attachment) => attachment.status === 'error')

  async function chooseFiles() {
    if (sendingRef.current || sending) return
    setError('')
    const limitError = attachmentSelectionError({ currentCount: attachments.length, selectedCount: 1 })
    if (limitError && attachments.length >= MAX_CHAT_ATTACHMENTS) {
      setError(limitError)
      return
    }
    setPicking(true)
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false)
        if (!permission.granted) {
          setError('Photo access is needed only to choose message attachments from your library.')
          return
        }
      }
      const selectionLimit = Math.max(1, MAX_CHAT_ATTACHMENTS - attachments.length)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit,
        quality: 0.8,
      })
      const selected = result.canceled ? [] : result.assets.slice(0, selectionLimit)
      if (selected.length === 0) return
      const overflow = attachmentSelectionError({ currentCount: attachments.length, selectedCount: selected.length })
      if (overflow && selected.length > selectionLimit) {
        setError(overflow)
      }
      const next: PendingChatAttachment[] = []
      for (const asset of selected) {
        const mimeType = asset.mimeType ?? 'image/jpeg'
        const fileName = asset.fileName ?? asset.uri.split('/').pop() ?? 'attachment'
        const fileSize = asset.fileSize ?? 0
        const invalid = validateChatAttachment({ mimeType, fileSize, fileName })
        if (invalid) {
          next.push({ id: `${Date.now()}-${next.length}`, uri: asset.uri, mimeType, fileName, fileSize, status: 'error', error: invalid, compressionPercent: 0, originalSize: fileSize })
          continue
        }
        const kind = chatAttachmentKind(mimeType)
        if (needsCompressionBeforeSend(kind, fileSize)) {
          next.push({
            id: `${Date.now()}-${next.length}`,
            uri: asset.uri,
            mimeType,
            fileName,
            fileSize,
            status: 'error',
            error: 'Large media needs compression before sending. Choose a smaller photo or video under 3 MB on this device.',
            compressionPercent: 0,
            originalSize: fileSize,
          })
          continue
        }
        next.push({ id: `${Date.now()}-${next.length}`, uri: asset.uri, mimeType, fileName, fileSize, status: 'ready', compressionPercent: 0, originalSize: fileSize })
      }
      const failed = next.find((attachment) => attachment.status === 'error')
      if (failed?.error) setError(failed.error)
      setAttachments((current) => [...current, ...next].slice(0, MAX_CHAT_ATTACHMENTS))
    } catch {
      setError('Your media library could not be opened. Please try again.')
    } finally {
      setPicking(false)
    }
  }

  function removeAttachment(attachmentId: string) {
    if (sendingRef.current) return
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
  }

  async function send() {
    if (sendingRef.current || !canRead || conversation?.otherUserSuspended || relationship?.blocked || relationship?.blockedByOther) return
    const trimmed = body.trim()
    if (!trimmed && readyAttachments.length === 0) {
      setError('Write a message or attach a file before sending.')
      return
    }
    if (trimmed) {
      const validatedMessage = validateMessageBody(body)
      if (!validatedMessage.ok) {
        setError(validatedMessage.message)
        return
      }
    }
    if (hasAttachmentErrors) {
      setError('Remove the file that could not be prepared before sending.')
      return
    }

    sendingRef.current = true
    setSending(true)
    setError('')
    const grants: Array<{ uploadId: DirectMessageUploadId; storageId?: StorageId; claimed: boolean }> = []
    try {
      for (const attachment of readyAttachments) {
        const prepared = await prepareChatUpload({ uri: attachment.uri, mimeType: attachment.mimeType })
        const grant = await generateUpload({})
        const tracked = { uploadId: grant.uploadId as DirectMessageUploadId, storageId: undefined as StorageId | undefined, claimed: false }
        grants.push(tracked)
        const storageId = await uploadChatAttachment(grant.uploadUrl, prepared) as StorageId
        tracked.storageId = storageId
        await registerUpload({
          uploadId: tracked.uploadId,
          storageId,
          fileName: normalizeAttachmentFileName(attachment.fileName),
          originalSize: attachment.originalSize,
          compressionPercent: 0,
        })
      }
      await sendMessage({
        conversationId: id as ConversationId,
        body: trimmed,
        attachmentUploadIds: grants.length ? grants.map((grant) => grant.uploadId) : undefined,
      })
      grants.forEach((grant) => { grant.claimed = true })
      setAttachments([])
      setBody('')
    } catch (caught) {
      await Promise.allSettled(grants.filter((grant) => !grant.claimed).map((grant) => discardUpload({ uploadId: grant.uploadId, storageId: grant.storageId }).catch(() => undefined)))
      setError(caught instanceof Error ? caught.message : 'Your message could not be sent. Please try again.')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  if (!canRead) return <ThreadState title="This conversation is unavailable" action="Return to Messages" onPress={() => router.replace('/messages')} />
  if (conversation === undefined || messagePage.status === 'LoadingFirstPage') return <PageSkeleton variant="conversation" />

  const canSubmit = canSubmitConversationMessage({
    body,
    readyAttachmentCount: readyAttachments.length,
    preparing: picking,
    hasErrors: hasAttachmentErrors,
    sending,
  })

  return (
    <ThreadView
      conversation={conversation}
      messages={messagePage.results}
      paginationStatus={messagePage.status}
      loadMore={() => messagePage.loadMore(30)}
      body={body}
      setBody={(value) => { setBody(value); setError('') }}
      sending={sending}
      picking={picking}
      attachments={attachments}
      canSubmit={canSubmit}
      error={error}
      onSend={() => void send()}
      onAttach={() => void chooseFiles()}
      onRemoveAttachment={removeAttachment}
      listRef={listRef}
      viewerId={viewerId}
      contactUnavailable={Boolean(relationship?.blocked || relationship?.blockedByOther)}
    />
  )
}

type PendingChatAttachment = {
  id: string
  uri: string
  mimeType: string
  fileName: string
  fileSize: number
  status: 'ready' | 'error'
  error?: string
  compressionPercent: number
  originalSize: number
}

function ThreadView({ conversation, messages, paginationStatus, loadMore, body, setBody, sending, picking, attachments, canSubmit, error, onSend, onAttach, onRemoveAttachment, listRef, viewerId, contactUnavailable }: {
  conversation: Conversation
  messages: Message[]
  paginationStatus: 'CanLoadMore' | 'LoadingMore' | 'Exhausted'
  loadMore: () => void
  body: string
  setBody: (value: string) => void
  sending: boolean
  picking: boolean
  attachments: PendingChatAttachment[]
  canSubmit: boolean
  error: string
  onSend: () => void
  onAttach: () => void
  onRemoveAttachment: (attachmentId: string) => void
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
      <KeyboardAvoidingView style={styles.safe} behavior={keyboardAvoidingBehavior(Platform.OS)}>
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
            <CompactComposer
              value={body}
              onChange={setBody}
              onSubmit={onSend}
              maxLength={2_100}
              sending={sending}
              disabled={counter.overLimit}
              canSubmit={canSubmit && !counter.overLimit}
              preparing={picking}
              showAttach
              attachDisabled={attachments.length >= MAX_CHAT_ATTACHMENTS}
              attachLoading={picking}
              onAttachPress={onAttach}
              hint="Photos and videos under 3 MB send in original quality. Larger media needs a smaller copy first."
              attachments={attachments.length ? (
                <>
                  {attachments.map((attachment) => (
                    <AttachmentMetaRow
                      key={attachment.id}
                      name={attachment.fileName}
                      detail={attachment.status === 'error'
                        ? attachment.error ?? 'This file could not be prepared.'
                        : `${formatFileSize(attachment.fileSize)} · ${describeChatAttachment({ fileSize: attachment.fileSize, originalSize: attachment.originalSize, compressionPercent: attachment.compressionPercent })}`}
                      state={attachment.status === 'error' ? 'danger' : 'success'}
                      actionLabel={`Remove ${attachment.fileName}`}
                      onAction={() => onRemoveAttachment(attachment.id)}
                    />
                  ))}
                </>
              ) : undefined}
            />
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
