import type { FunctionReturnType } from 'convex/server'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { router, useFocusEffect, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as Linking from 'expo-linking'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, FlatList, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { extractConvexErrorMessage, NOTIFICATION_HIGHLIGHT_MS } from '@lets-be-friends/shared'

import { mobileApi, type ConversationId, type DirectMessageUploadId, type StorageId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { BookingCard } from '@/design-system/organisms/BookingCard'
import { AttachmentMetaRow } from '@/design-system/molecules/AttachmentMetaRow'
import { ActionSheet } from '@/design-system/molecules/ActionSheet'
import { ConfirmationDialog } from '@/design-system/molecules/ConfirmationDialog'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { ReportAction } from '@/features/safety/ReportAction'
import { AppText } from '@/design-system/atoms/Typography'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { keyboardAvoidingBehavior } from '@/design-system/templates/Screen'
import { CompactComposer } from '@/features/messaging/CompactComposer'
import { MessageAttachmentMedia, PendingAttachmentTray } from '@/features/messaging/ChatAttachmentPreview'
import { ComposerContextBanner } from '@/features/messaging/ComposerContextBanner'
import { ConversationDetailsSheet } from '@/features/messaging/ConversationDetailsSheet'
import { MessageActionsSheet } from '@/features/messaging/MessageActionsSheet'
import { MessageBubble, MessageQuote } from '@/features/messaging/MessageBubble'
import { NewMessagesPill } from '@/features/messaging/NewMessagesPill'
import { SwipeableMessageRow } from '@/features/messaging/SwipeableMessageRow'
import { BookingMessageShell, ConversationThreadHeader } from '@/features/messaging/ConversationThreadPresentation'
import { bookingDestinationForViewer } from '@/data/bookingActions'
import {
  attachmentSelectionError,
  canSubmitConversationMessage,
  chatAttachmentKind,
  chatDocumentMimeType,
  chatUploadRegistration,
  CHAT_DOCUMENT_MIME_TYPES,
  MAX_CHAT_ATTACHMENTS,
  needsCompressionBeforeSend,
  normalizeAttachmentFileName,
  validateChatAttachment,
  type PendingChatAttachment,
} from '@/data/chatAttachments'
import { prepareChatUpload, uploadChatAttachment } from '@/features/messaging/chatAttachmentUpload'
import { downloadChatAttachment } from '@/features/messaging/downloadChatAttachment'
import {
  formatFileSize,
  formatMessageTimestamp,
  conversationBookingCardView,
  countMessagesAfter,
  isMessageListAtLatest,
  messageCounter,
  shouldShowMessageCounter,
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
  const params = useLocalSearchParams<{ id?: string; messageId?: string }>()
  const id = typeof params.id === 'string' ? params.id : ''
  const messageId = typeof params.messageId === 'string' ? params.messageId : ''
  const canRead = Boolean(id)
  const conversation = useQuery(mobileApi.conversations.conversation, canRead ? { conversationId: id as ConversationId } : 'skip')
  const messagePage = usePaginatedQuery(
    mobileApi.conversations.messagePage,
    canRead ? { conversationId: id as ConversationId } : 'skip',
    { initialNumItems: 30 },
  )
  const markRead = useMutation(mobileApi.conversations.markRead)
  const sendMessage = useMutation(mobileApi.conversations.sendMessage)
  const saveEdit = useMutation(mobileApi.conversations.editMessage)
  const removeMessage = useMutation(mobileApi.conversations.deleteMessage)
  const unsendMessage = useMutation(mobileApi.conversations.unsendMessage)
  const removeConversation = useMutation(mobileApi.conversations.deleteConversation)
  const generateUpload = useMutation(mobileApi.conversations.generateAttachmentUploadUrl)
  const registerUpload = useMutation(mobileApi.conversations.registerAttachmentUpload)
  const discardUpload = useMutation(mobileApi.conversations.discardAttachmentUpload)
  const relationship = useQuery(mobileApi.safety.relationship, conversation ? { userId: conversation.otherUserId } : 'skip')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [picking, setPicking] = useState(false)
  const [attachments, setAttachments] = useState<PendingChatAttachment[]>([])
  const [error, setError] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  const [actionMessage, setActionMessage] = useState<Message | null>(null)
  const [reportMessage, setReportMessage] = useState<Message | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null)
  const [unsendTarget, setUnsendTarget] = useState<Message | null>(null)
  const [deleteConversationOpen, setDeleteConversationOpen] = useState(false)
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
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

  async function chooseMedia() {
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

  async function chooseDocuments() {
    if (sendingRef.current || sending) return
    setError('')
    const available = MAX_CHAT_ATTACHMENTS - attachments.length
    if (available <= 0) {
      setError('Messages can include up to 4 files. Remove one before adding another.')
      return
    }
    setPicking(true)
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: CHAT_DOCUMENT_MIME_TYPES,
        multiple: true,
        copyToCacheDirectory: true,
      })
      if (result.canceled) return
      const selected = result.assets.slice(0, available)
      if (result.assets.length > available) {
        setError(`Only the first ${available} file${available === 1 ? ' was' : 's were'} added. Messages can include up to 4 files.`)
      }
      const next: PendingChatAttachment[] = []
      for (const asset of selected) {
        const fileName = asset.name
        const mimeType = chatDocumentMimeType(fileName, asset.mimeType)
        const fileSize = asset.size ?? 0
        const invalid = validateChatAttachment({ mimeType, fileSize, fileName })
        if (invalid) {
          next.push({ id: `${Date.now()}-${next.length}`, uri: asset.uri, mimeType, fileName, fileSize, status: 'error', error: invalid, compressionPercent: 0, originalSize: fileSize })
          continue
        }
        next.push({ id: `${Date.now()}-${next.length}`, uri: asset.uri, mimeType, fileName, fileSize, status: 'ready', compressionPercent: 0, originalSize: fileSize })
      }
      const failed = next.find((attachment) => attachment.status === 'error')
      if (failed?.error) setError(failed.error)
      setAttachments((current) => [...current, ...next].slice(0, MAX_CHAT_ATTACHMENTS))
    } catch {
      setError('Your files could not be opened. Please try again.')
    } finally {
      setPicking(false)
    }
  }

  function removeAttachment(attachmentId: string) {
    if (sendingRef.current) return
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
  }

  useEffect(() => {
    const currentMessages = new Map(messagePage.results.map((message) => [String(message._id), message]))
    if (replyTo) {
      const current = currentMessages.get(String(replyTo._id))
      if (!current || current.deletedAt) setReplyTo(null)
    }
    if (editing) {
      const current = currentMessages.get(String(editing._id))
      if (!current || current.deletedAt || !current.sentByViewer) {
        setEditing(null)
        setBody('')
      }
    }
    if (deleteTarget && !currentMessages.has(String(deleteTarget._id))) setDeleteTarget(null)
    if (unsendTarget && !currentMessages.has(String(unsendTarget._id))) setUnsendTarget(null)
  }, [messagePage.results, replyTo, editing, deleteTarget, unsendTarget])

  function startReply(message: Message) {
    if (editing) setBody('')
    setEditing(null)
    setReplyTo(message)
    setError('')
  }

  function startEdit(message: Message) {
    setReplyTo(null)
    setAttachments([])
    setEditing(message)
    setBody(message.body)
    setError('')
  }

  function cancelComposerContext() {
    if (editing) setBody('')
    setEditing(null)
    setReplyTo(null)
    setError('')
  }

  function openMessageActions(message: Message) {
    if (message.booking || message.deletedAt) return
    setActionMessage(message)
  }

  async function confirmDeleteMessage() {
    if (!deleteTarget || actionBusy) return
    setActionBusy(true)
    setError('')
    try {
      await removeMessage({ messageId: deleteTarget._id })
      if (replyTo && String(replyTo._id) === String(deleteTarget._id)) setReplyTo(null)
      if (editing && String(editing._id) === String(deleteTarget._id)) {
        setEditing(null)
        setBody('')
      }
    } catch (caught) {
      setError(extractConvexErrorMessage(caught, 'This message could not be deleted.'))
    } finally {
      setDeleteTarget(null)
      setActionBusy(false)
    }
  }

  async function confirmUnsendMessage() {
    if (!unsendTarget || actionBusy) return
    setActionBusy(true)
    setError('')
    try {
      await unsendMessage({ messageId: unsendTarget._id })
      if (replyTo && String(replyTo._id) === String(unsendTarget._id)) setReplyTo(null)
      if (editing && String(editing._id) === String(unsendTarget._id)) {
        setEditing(null)
        setBody('')
      }
    } catch (caught) {
      setError(extractConvexErrorMessage(caught, 'This message could not be unsent.'))
    } finally {
      setUnsendTarget(null)
      setActionBusy(false)
    }
  }

  async function confirmDeleteConversation() {
    if (actionBusy) return
    setActionBusy(true)
    setError('')
    try {
      await removeConversation({ conversationId: id as ConversationId })
      setDeleteConversationOpen(false)
      router.replace('/messages')
    } catch (caught) {
      setError(extractConvexErrorMessage(caught, 'This conversation could not be deleted.'))
      setDeleteConversationOpen(false)
    } finally {
      setActionBusy(false)
    }
  }

  async function send() {
    if (sendingRef.current || !canRead || conversation?.otherUserSuspended || relationship?.blocked || relationship?.blockedByOther) return
    if (editing) {
      const trimmedEdit = body.trim()
      if (!trimmedEdit) {
        setError('Write a message before saving.')
        return
      }
      const validatedEdit = validateMessageBody(body)
      if (!validatedEdit.ok) {
        setError(validatedEdit.message)
        return
      }
      sendingRef.current = true
      setSending(true)
      setError('')
      try {
        await saveEdit({ messageId: editing._id, body: trimmedEdit })
        setEditing(null)
        setBody('')
      } catch (caught) {
        setError(extractConvexErrorMessage(caught, 'Your message could not be saved. Please try again.'))
      } finally {
        sendingRef.current = false
        setSending(false)
      }
      return
    }
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
          ...chatUploadRegistration(prepared.fileSize),
        })
      }
      await sendMessage({
        conversationId: id as ConversationId,
        body: trimmed,
        attachmentUploadIds: grants.length ? grants.map((grant) => grant.uploadId) : undefined,
        replyToMessageId: replyTo?._id,
      })
      grants.forEach((grant) => { grant.claimed = true })
      setAttachments([])
      setBody('')
      setReplyTo(null)
    } catch (caught) {
      await Promise.allSettled(grants.filter((grant) => !grant.claimed).map((grant) => discardUpload({ uploadId: grant.uploadId, storageId: grant.storageId }).catch(() => undefined)))
      setError(extractConvexErrorMessage(caught, 'Your message could not be sent. Please try again.'))
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  if (!canRead) return <ThreadState title="This conversation is unavailable" action="Return to Messages" onPress={() => router.replace('/messages')} />
  if (conversation === undefined || messagePage.status === 'LoadingFirstPage') return <PageSkeleton variant="conversation" />

  const canSubmit = editing
    ? Boolean(body.trim()) && !sending
    : canSubmitConversationMessage({
        body,
        readyAttachmentCount: readyAttachments.length,
        preparing: picking,
        hasErrors: hasAttachmentErrors,
        sending,
      })

  return (
    <>
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
        replyTo={replyTo}
        editing={editing}
        onCancelContext={cancelComposerContext}
        onReply={startReply}
        onOpenActions={openMessageActions}
        onOpenMenu={() => setConversationMenuOpen(true)}
        onSend={() => void send()}
        onAttach={() => setAttachMenuOpen(true)}
        onRemoveAttachment={removeAttachment}
        listRef={listRef}
        viewerId={viewerId}
        focusMessageId={messageId || undefined}
        contactUnavailable={Boolean(relationship?.blocked || relationship?.blockedByOther)}
      />

      <MessageActionsSheet
        message={actionMessage ? {
          id: String(actionMessage._id),
          sentByViewer: actionMessage.sentByViewer,
          deleted: Boolean(actionMessage.deletedAt),
          booking: Boolean(actionMessage.booking),
        } : null}
        canCompose={!conversation.otherUserSuspended && !relationship?.blocked && !relationship?.blockedByOther}
        onClose={() => setActionMessage(null)}
        onReply={() => {
          const target = actionMessage
          setActionMessage(null)
          if (target) startReply(target)
        }}
        onEdit={() => {
          const target = actionMessage
          setActionMessage(null)
          if (target) startEdit(target)
        }}
        onDelete={() => {
          const target = actionMessage
          setActionMessage(null)
          // Let the options sheet finish closing before presenting the dialog.
          if (target) setTimeout(() => setDeleteTarget(target), 220)
        }}
        onUnsend={() => {
          const target = actionMessage
          setActionMessage(null)
          if (target) setTimeout(() => setUnsendTarget(target), 220)
        }}
        onReport={() => {
          const target = actionMessage
          setActionMessage(null)
          if (target) setTimeout(() => setReportMessage(target), 220)
        }}
      />

      <ConfirmationDialog
        visible={Boolean(deleteTarget)}
        title="Delete message?"
        description='Both members will see "Message deleted" instead. The content stays available only for safety review.'
        confirmLabel="Delete message"
        busyLabel="Deleting"
        busy={actionBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteMessage()}
      />

      <ConfirmationDialog
        visible={Boolean(unsendTarget)}
        title="Unsend message?"
        description="This removes the message for both members, including the deleted notice."
        confirmLabel="Unsend message"
        busyLabel="Unsending"
        busy={actionBusy}
        onClose={() => setUnsendTarget(null)}
        onConfirm={() => void confirmUnsendMessage()}
      />

      <ConfirmationDialog
        visible={deleteConversationOpen}
        title="Delete conversation?"
        description="This hides the conversation from your Messages list. The other member keeps their copy, and a new message will bring it back."
        confirmLabel="Delete conversation"
        busyLabel="Deleting"
        busy={actionBusy}
        onClose={() => setDeleteConversationOpen(false)}
        onConfirm={() => void confirmDeleteConversation()}
      />

      <ActionSheet
        visible={attachMenuOpen}
        title="Add attachment"
        description="Photos and videos appear in the conversation. Documents are downloaded when tapped."
        items={[
          {
            label: 'Photo or video',
            icon: 'images-outline',
            tone: 'neutral',
            onPress: () => setTimeout(() => { void chooseMedia() }, 220),
          },
          {
            label: 'Document',
            icon: 'document-text-outline',
            tone: 'neutral',
            onPress: () => setTimeout(() => { void chooseDocuments() }, 220),
          },
        ]}
        onClose={() => setAttachMenuOpen(false)}
      />

      <ActionSheet
        visible={conversationMenuOpen}
        title="Conversation options"
        description={`Conversation with ${conversation.otherDisplayName}`}
        items={[
          {
            label: 'Conversation details',
            icon: 'images-outline',
            tone: 'neutral',
            onPress: () => setTimeout(() => setDetailsOpen(true), 220),
          },
          {
            label: 'Delete conversation',
            icon: 'trash-outline',
            tone: 'danger',
            onPress: () => setTimeout(() => setDeleteConversationOpen(true), 220),
          },
        ]}
        onClose={() => setConversationMenuOpen(false)}
      />

      <ConversationDetailsSheet
        visible={detailsOpen}
        conversationId={id}
        otherName={conversation.otherDisplayName}
        imageUrl={conversation.otherProfileImageUrl}
        paused={conversation.otherUserSuspended}
        onClose={() => setDetailsOpen(false)}
      />

      <ReportAction
        targetType="message"
        targetId={reportMessage ? String(reportMessage._id) : ''}
        label="Report message"
        showTrigger={false}
        open={Boolean(reportMessage)}
        onOpenChange={(open) => { if (!open) setReportMessage(null) }}
      />
    </>
  )
}

function ThreadView({ conversation, messages, paginationStatus, loadMore, body, setBody, sending, picking, attachments, canSubmit, error, replyTo, editing, onCancelContext, onReply, onOpenActions, onOpenMenu, onSend, onAttach, onRemoveAttachment, listRef, viewerId, focusMessageId, contactUnavailable }: {
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
  replyTo: Message | null
  editing: Message | null
  onCancelContext: () => void
  onReply: (message: Message) => void
  onOpenActions: (message: Message) => void
  onOpenMenu: () => void
  onSend: () => void
  onAttach: () => void
  onRemoveAttachment: (attachmentId: string) => void
  listRef: React.RefObject<FlatList<Message> | null>
  viewerId: string
  focusMessageId?: string
  contactUnavailable: boolean
}) {
  const theme = useAppTheme()
  const counter = messageCounter(body)
  const suspended = conversation.otherUserSuspended
  const canCompose = !suspended && !contactUnavailable
  const chronologicalMessages = useMemo(() => [...messages].reverse(), [messages])
  const initialSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadingOlderRef = useRef(false)
  const topSentinelRef = useRef<View>(null)
  const [initialScrollReady, setInitialScrollReady] = useState(Boolean(focusMessageId))
  const [allowMaintainVisible, setAllowMaintainVisible] = useState(false)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const handledFocusMessageId = useRef<string | null>(null)
  const focusAttempts = useRef(0)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const focusIndex = focusMessageId
    ? chronologicalMessages.findIndex((message) => String(message._id) === focusMessageId)
    : -1
  const atLatestRef = useRef(true)
  const pendingNewestRef = useRef(false)
  const lastComposerHeight = useRef(0)
  const [composerHeight, setComposerHeight] = useState(0)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const latestMessage = chronologicalMessages[chronologicalMessages.length - 1]
  const latestMessageId = latestMessage ? String(latestMessage._id) : ''
  const seenLatestId = useRef(latestMessageId)

  const followLatestMessage = useCallback((animated: boolean) => {
    if (!atLatestRef.current) return
    listRef.current?.scrollToEnd({ animated })
  }, [listRef])

  const showLatestMessages = useCallback(() => {
    atLatestRef.current = true
    pendingNewestRef.current = false
    setNewMessageCount(0)
    listRef.current?.scrollToEnd({ animated: true })
  }, [listRef])

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
  }, [])

  /** A different conversation starts a fresh reading position. */
  useEffect(() => {
    seenLatestId.current = latestMessageId
    pendingNewestRef.current = false
    atLatestRef.current = true
    didInitialScroll.current = false
    handledFocusMessageId.current = null
    setNewMessageCount(0)
    setHighlightedMessageId(null)
  }, [conversation._id])

  /**
   * New messages follow the same rule as the web thread: the newest message
   * stays in view, and a message the member sends always brings them back. When
   * they are reading older messages, the count waits behind a jump control
   * instead of moving the list under them.
   */
  useEffect(() => {
    const previousLatestId = seenLatestId.current
    if (!latestMessageId || latestMessageId === previousLatestId) return
    seenLatestId.current = latestMessageId
    const appended = countMessagesAfter(chronologicalMessages, previousLatestId)
    if (appended === 0) return
    if (!focusMessageId && (atLatestRef.current || latestMessage?.sentByViewer)) {
      pendingNewestRef.current = true
      setNewMessageCount(0)
      return
    }
    setNewMessageCount((count) => count + appended)
  }, [chronologicalMessages, focusMessageId, latestMessage, latestMessageId])

  /**
   * The keyboard changes the visible list height, so the newest message would
   * otherwise sit behind the composer. Pull it back up once the keyboard
   * settles, but leave the list alone when the member is reading older
   * messages.
   */
  useEffect(() => {
    if (Platform.OS === 'web') return
    let settleTimer: ReturnType<typeof setTimeout> | undefined
    const subscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        if (!atLatestRef.current) return
        listRef.current?.scrollToEnd({ animated: true })
        if (settleTimer) clearTimeout(settleTimer)
        settleTimer = setTimeout(() => followLatestMessage(false), 180)
      },
    )
    return () => {
      subscription.remove()
      if (settleTimer) clearTimeout(settleTimer)
    }
  }, [followLatestMessage, listRef])

  const handleMessageListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const nextAtLatest = isMessageListAtLatest({
      offsetY: contentOffset.y,
      contentHeight: contentSize.height,
      viewportHeight: layoutMeasurement.height,
    })
    atLatestRef.current = nextAtLatest
    if (nextAtLatest) setNewMessageCount((count) => (count === 0 ? count : 0))
  }, [])

  const handleComposerLayout = useCallback((height: number) => {
    if (lastComposerHeight.current === height) return
    lastComposerHeight.current = height
    setComposerHeight(height)
    if (!atLatestRef.current) return
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
  }, [listRef])

  useEffect(() => {
    if (!focusMessageId || handledFocusMessageId.current === focusMessageId) return
    if (focusIndex === -1) {
      if (paginationStatus === 'CanLoadMore' && focusAttempts.current < 5) {
        focusAttempts.current += 1
        loadMore()
      }
      return
    }
    handledFocusMessageId.current = focusMessageId
    const scrollTimer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: focusIndex, animated: true, viewPosition: 0.5 })
      setHighlightedMessageId(focusMessageId)
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
      highlightTimer.current = setTimeout(() => setHighlightedMessageId(null), NOTIFICATION_HIGHLIGHT_MS)
    }, 120)
    return () => clearTimeout(scrollTimer)
  }, [focusIndex, focusMessageId, listRef, loadMore, paginationStatus])

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.safe} behavior={keyboardAvoidingBehavior(Platform.OS)}>
        <ConversationThreadHeader
          name={conversation.otherDisplayName}
          imageUrl={conversation.otherProfileImageUrl}
          paused={suspended}
          onBack={goBackOrMessages}
          onOpenMenu={onOpenMenu}
          onSafety={() => router.push({ pathname: '/safety' as never, params: { userId: String(conversation.otherUserId), name: conversation.otherDisplayName } } as never)}
        />
        <FlatList
          ref={listRef}
          data={chronologicalMessages}
          keyExtractor={(message) => message._id}
          renderItem={({ item }) => {
            const row = <MessageItem message={item} otherName={conversation.otherDisplayName} viewerId={viewerId} highlighted={highlightedMessageId === String(item._id)} />
            if (item.booking || item.deletedAt) return row
            return (
              <SwipeableMessageRow
                onReply={canCompose ? () => onReply(item) : undefined}
                onOpenActions={() => onOpenActions(item)}
              >
                {row}
              </SwipeableMessageRow>
            )
          }}
          contentContainerStyle={[styles.messages, messages.length === 0 ? styles.messagesEmpty : styles.messagesFilled]}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true })
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 }), 320)
          }}
          onContentSizeChange={() => {
            if (focusMessageId) return
            if (!didInitialScroll.current) {
              didInitialScroll.current = true
              listRef.current?.scrollToEnd({ animated: false })
              return
            }
            if (pendingNewestRef.current) {
              pendingNewestRef.current = false
              listRef.current?.scrollToEnd({ animated: true })
              return
            }
            followLatestMessage(false)
          }}
          onScroll={handleMessageListScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={paginationStatus === 'CanLoadMore'
            ? <ActionButton label="Load earlier messages" onPress={loadMore} secondary />
            : paginationStatus === 'LoadingMore'
              ? <AppText variant="caption" color={theme.colors.textMuted}>Loading earlier messages.</AppText>
              : null}
          ListEmptyComponent={<View style={styles.empty}><AppText variant="heading">No messages yet</AppText><AppText color={theme.colors.textMuted}>Say hello when you are ready.</AppText></View>}
        />
        {newMessageCount > 0 && canCompose ? (
          <View style={[styles.newMessagesAnchor, { bottom: composerHeight + 8 }]}>
            <NewMessagesPill count={newMessageCount} onPress={showLatestMessages} />
          </View>
        ) : null}
        {suspended || contactUnavailable ? <View style={[styles.suspended, { borderTopColor: theme.colors.border }]}><AppText color={theme.colors.textMuted}>{contactUnavailable ? 'New contact is stopped for this member connection. Existing messages and booking records remain available.' : 'This conversation is paused and cannot receive new messages.'}</AppText></View> : (
          <View
            onLayout={(event) => handleComposerLayout(event.nativeEvent.layout.height)}
            style={[styles.composer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
            <CompactComposer
              value={body}
              onChange={setBody}
              onSubmit={onSend}
              maxLength={2_100}
              sending={sending}
              disabled={counter.overLimit}
              canSubmit={canSubmit && !counter.overLimit}
              preparing={picking}
              contextBanner={editing
                ? <ComposerContextBanner mode="edit" title="Editing message" preview={composerContextPreview(editing)} onCancel={onCancelContext} />
                : replyTo
                  ? <ComposerContextBanner mode="reply" title={`Replying to ${replyTo.sentByViewer ? 'yourself' : conversation.otherDisplayName}`} preview={composerContextPreview(replyTo)} onCancel={onCancelContext} />
                  : undefined}
              showAttach={!editing}
              attachDisabled={attachments.length >= MAX_CHAT_ATTACHMENTS}
              attachLoading={picking}
              onAttachPress={onAttach}
              submitLabel={editing ? 'Save changes' : 'Send'}
              attachments={attachments.length ? (
                <PendingAttachmentTray
                  attachments={attachments}
                  onRemove={onRemoveAttachment}
                  disabled={sending}
                />
              ) : undefined}
            />
            {shouldShowMessageCounter(counter.count) ? (
              <AppText variant="caption" color={counter.overLimit ? theme.colors.danger : theme.colors.textMuted}>{counter.count.toLocaleString()}/2,000 characters</AppText>
            ) : null}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function MessageItem({ message, otherName, viewerId, highlighted = false }: {
  message: Message
  otherName: string
  viewerId: string
  highlighted?: boolean
}) {
  const theme = useAppTheme()
  const [attachmentError, setAttachmentError] = useState('')

  async function openAttachmentUrl(url: string) {
    setAttachmentError('')
    try {
      await Linking.openURL(url)
    } catch {
      setAttachmentError('This private attachment could not be opened. Please try again.')
    }
  }

  async function downloadAttachment(url: string, fileName: string) {
    setAttachmentError('')
    try {
      await downloadChatAttachment(url, fileName)
    } catch {
      setAttachmentError('This file could not be downloaded. Please try again.')
    }
  }

  const sharedMedia = message.attachments.filter((attachment) => attachment.kind !== 'file' && Boolean(attachment.url))
  const sharedFiles = message.attachments.filter((attachment) => attachment.kind === 'file' || !attachment.url)
  const replyQuote = message.replyTo ? (
    <MessageQuote
      author={message.replyTo.sentByViewer ? 'You' : otherName}
      preview={message.replyTo.deleted
        ? 'Message deleted'
        : message.replyTo.body.trim() || (message.replyTo.attachmentCount === 1
          ? '1 attachment'
          : `${message.replyTo.attachmentCount} attachments`)}
    />
  ) : undefined

  if (message.booking) {
    const destination = bookingDestinationForViewer(viewerId, {
      bookingId: String(message.booking.bookingId),
      memberId: String(message.booking.memberId),
      companionUserId: message.booking.companionUserId ? String(message.booking.companionUserId) : undefined,
    })
    return (
      <BookingMessageShell
        body={message.body}
        showBody={message.booking.status === 'cancelled'}
        category={message.booking.category}
        booking={destination ? (
          <BookingCard
            compact
            booking={conversationBookingCardView(message.booking, viewerId)}
            onPress={() => router.push(destination)}
          />
        ) : undefined}
      />
    )
  }

  return (
    <MessageBubble
      direction={message.sentByViewer ? 'outgoing' : 'incoming'}
      authorName={otherName}
      body={message.deletedAt ? 'Message deleted' : message.body}
      deleted={Boolean(message.deletedAt)}
      quote={replyQuote}
      timestamp={`${formatMessageTimestamp(message.createdAt)}${message.editedAt ? ' · Edited' : ''}`}
      highlighted={highlighted}
      attachments={message.attachments.length ? <>
          {sharedMedia.length ? (
            <MessageAttachmentMedia
              attachments={sharedMedia.map((item) => ({
                storageId: String(item.storageId),
                fileName: item.fileName,
                kind: item.kind,
                url: item.url ?? undefined,
              }))}
              onOpen={(url) => void openAttachmentUrl(url)}
            />
          ) : null}
          {sharedFiles.map((item, index) => {
            const storageId = String(item.storageId)
            const url = item.url
            return (
              <AttachmentMetaRow
                key={`${storageId}-${index}`}
                name={item.fileName}
                detail={`${formatFileSize(item.size)} · ${url ? 'Download file' : 'Secure link unavailable'}`}
                state={url ? 'default' : 'danger'}
                actionRole="link"
                actionLabel={url ? `Download attachment ${item.fileName}` : undefined}
                onAction={url ? () => void downloadAttachment(url, item.fileName) : undefined}
              />
            )
          })}
        </> : undefined}
      footer={attachmentError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{attachmentError}</AppText> : undefined}
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
  messagesFilled: { flexGrow: 1, justifyContent: 'flex-end' },
  empty: { alignItems: 'center', gap: 8 },
  composer: { borderTopWidth: 1, padding: 12, gap: 8 },
  newMessagesAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
    pointerEvents: 'box-none',
  },
  suspended: { borderTopWidth: 1, padding: 14 },
})

function composerContextPreview(message: Message) {
  if (message.deletedAt) return 'Message deleted'
  const body = message.body.trim()
  if (body) return body
  const count = message.attachments.length
  if (count === 1) return '1 attachment'
  if (count > 1) return `${count} attachments`
  return 'Message'
}

function goBackOrMessages() {
  if (router.canGoBack()) router.back()
  else router.replace('/messages')
}
