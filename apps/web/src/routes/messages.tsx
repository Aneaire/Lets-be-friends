import { SignInButton, useAuth } from '@clerk/react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowLeft, CircleCheck, Ellipsis, EyeOff, FileText, Flag, Image as ImageIcon, Link2, LoaderCircle, MessageCircle, Pencil, Reply, ShieldCheck, Trash2, Video, X } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { NOTIFICATION_HIGHLIGHT_MS } from '@lets-be-friends/shared'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { ConversationBookingPin } from '../features/booking/ConversationBookingPin'
import { BookingRequestEditor, type EditableBookingRequest } from '../features/booking/BookingRequestEditor'
import { usePinnedBookingDismissal } from '../features/booking/usePinnedBookingDismissal'
import { Avatar } from '../design-system/atoms/Avatar'
import { CompactComposer } from '../features/messaging/CompactComposer'
import { ConversationListItemContent } from '../features/messaging/ConversationListItem'
import { MessageBubble } from '../features/messaging/MessageBubble'
import { PendingOutgoingMessageBubble } from '../features/messaging/PendingOutgoingMessageBubble'
import { AttachmentMetaRow } from '../design-system/molecules/AttachmentMetaRow'
import { ActionMenu } from '../design-system/molecules/ActionMenu'
import { ConfirmationDialog, Dialog } from '../design-system/molecules/Dialog'
import { MessageImageGallery, MessageImageViewer, type MessageImage } from '../design-system/molecules/MessageImages'
import {
  MAX_CHAT_ATTACHMENTS,
  formatFileSize,
  prepareChatAttachment,
  type PreparedChatAttachment,
} from '../lib/chatAttachments'
import { bookingMessagePresentation, conversationBookingThread } from '../lib/messageBookings';
import { describeConvexError } from '../lib/convexErrors'

export const Route = createFileRoute('/messages')({
  validateSearch: (search: Record<string, unknown>): { conversationId?: string; messageId?: string } => ({
    ...(typeof search.conversationId === 'string' ? { conversationId: search.conversationId } : {}),
    ...(typeof search.messageId === 'string' ? { messageId: search.messageId } : {}),
  }),
  component: MessagesPage,
})

type Conversation = NonNullable<ReturnType<typeof useQuery<typeof api.conversations.list>>>[number]
type Thread = NonNullable<ReturnType<typeof useQuery<typeof api.conversations.messages>>>
type ThreadAttachment = Thread['messages'][number]['attachments'][number]
type ThreadMessage = Thread['messages'][number]
type ThreadReply = NonNullable<Thread['messages'][number]['replyTo']>
type ConversationAssets = NonNullable<ReturnType<typeof useQuery<typeof api.conversations.assets>>>
type PendingAttachment = {
  id: string
  source: File
  prepared?: PreparedChatAttachment
  previewUrl?: string
  progress: number
  status: 'preparing' | 'ready' | 'error'
  error?: string
}
type PendingOutgoingMessage = {
  body: string
  attachmentNames: string[]
  createdAt: number
  messageId?: Id<'directMessages'>
}

export function MessagesPage() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()
  const { conversationId, messageId } = Route.useSearch()
  const conversations = useQuery(api.conversations.list, isSignedIn ? {} : 'skip') as Conversation[] | undefined
  const viewer = useQuery(api.users.viewer, isSignedIn ? {} : 'skip')
  const selectedConversationId = conversationId ? conversationId as Id<'directConversations'> : undefined
  const thread = useQuery(
    api.conversations.messages,
    isSignedIn && selectedConversationId ? { conversationId: selectedConversationId } : 'skip',
  )
  const { latestBookingStatus } = bookingMessagePresentation(thread?.messages ?? [])
  const { current: currentBooking, history: previousBookings } = conversationBookingThread(thread?.messages ?? [])
  const { dismissed: bookingDismissed, dismiss: dismissCurrentBooking } = usePinnedBookingDismissal({
    conversationId: selectedConversationId,
    bookingId: currentBooking?.booking.bookingId,
  })
  const currentBookingMessage = thread && currentBooking ? thread.messages[currentBooking.messageIndex] : undefined
  const latestBookingEnded = latestBookingStatus === 'completed' || latestBookingStatus === 'review_window' || latestBookingStatus === 'closed'
  const canCompose = !thread?.conversation.otherUserSuspended
  const report = useMutation(api.reports.create)
  const decideBooking = useMutation(api.bookings.companionDecision)
  const updateBookingRequest = useMutation(api.bookings.editRequest)
  const markRead = useMutation(api.conversations.markRead)
  const editMessage = useMutation(api.conversations.editMessage)
  const deleteMessage = useMutation(api.conversations.deleteMessage)
  const unsendMessage = useMutation(api.conversations.unsendMessage)
  const deleteConversation = useMutation(api.conversations.deleteConversation)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [pendingOutgoing, setPendingOutgoing] = useState<PendingOutgoingMessage | null>(null)
  const [editingBooking, setEditingBooking] = useState<EditableBookingRequest | null>(null)
  const [openImage, setOpenImage] = useState<MessageImage | null>(null)
  const [replyTo, setReplyTo] = useState<ThreadMessage | null>(null)
  const [editingMessage, setEditingMessage] = useState<ThreadMessage | null>(null)
  const [actionMessage, setActionMessage] = useState<ThreadMessage | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ThreadMessage | null>(null)
  const [unsendTarget, setUnsendTarget] = useState<ThreadMessage | null>(null)
  const [deleteConversationOpen, setDeleteConversationOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const editingCompanion = useQuery(api.companions.getPublic, editingBooking?.companionProfileId ? { companionProfileId: editingBooking.companionProfileId } : 'skip')
  const assets = useQuery(
    api.conversations.assets,
    isSignedIn && selectedConversationId && detailsOpen ? { conversationId: selectedConversationId } : 'skip',
  )
  const threadEndRef = useRef<HTMLDivElement>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

  useEffect(() => {
    setReplyTo(null)
    setEditingMessage(null)
    setActionMessage(null)
    setDeleteTarget(null)
    setUnsendTarget(null)
    setDeleteConversationOpen(false)
    setDetailsOpen(false)
  }, [selectedConversationId])

  useEffect(() => {
    if (!thread) return
    if (editingMessage) {
      const current = thread.messages.find((message) => message._id === editingMessage._id)
      if (!current || current.deletedAt) setEditingMessage(null)
    }
    if (replyTo) {
      const current = thread.messages.find((message) => message._id === replyTo._id)
      if (!current || current.deletedAt) setReplyTo(null)
    }
    if (actionMessage) {
      const current = thread.messages.find((message) => message._id === actionMessage._id)
      if (!current || current.deletedAt) setActionMessage(null)
    }
  }, [thread, editingMessage, replyTo, actionMessage])

  useEffect(() => {
    if (!messageId) {
      setHighlightedMessageId(null)
      return
    }
    setHighlightedMessageId(String(messageId))
    const timer = window.setTimeout(() => setHighlightedMessageId(null), NOTIFICATION_HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [messageId])

  useEffect(() => {
    const target = messageId ? document.getElementById(`message-${messageId}`) : null
    if (target) target.scrollIntoView({ block: 'center' })
    else threadEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messageId, pendingOutgoing, thread?.messages.length, replyTo, editingMessage])

  useEffect(() => {
    setPendingOutgoing(null)
  }, [selectedConversationId])

  useEffect(() => {
    if (isSignedIn && selectedConversationId) {
      void markRead({ conversationId: selectedConversationId })
    }
    // A message that arrives while the chat is open is already being read, so
    // mark it read too instead of leaving an unread notification behind.
  }, [isSignedIn, markRead, selectedConversationId, thread?.messages.length])

  async function reportMessage(messageTargetId: Id<'directMessages'>) {
    setError('')
    try {
      await report({ targetType: 'message', targetId: messageTargetId, reason: 'Message needs safety review' })
      setNotice('Message sent to safety review.')
    } catch (reportError) {
      setNotice('')
      setError(reportError instanceof Error ? describeConvexError(reportError) : 'Message could not be reported.')
    }
  }

  function beginReply(message: ThreadMessage) {
    setEditingMessage(null)
    setReplyTo(message)
    setError('')
  }

  function beginEdit(message: ThreadMessage) {
    setReplyTo(null)
    setEditingMessage(message)
    setError('')
  }

  function cancelComposerContext() {
    setReplyTo(null)
    setEditingMessage(null)
  }

  async function confirmDeleteMessage() {
    if (!deleteTarget || actionBusy) return
    setActionBusy(true)
    setError('')
    try {
      await deleteMessage({ messageId: deleteTarget._id })
      if (replyTo && replyTo._id === deleteTarget._id) setReplyTo(null)
      if (editingMessage && editingMessage._id === deleteTarget._id) setEditingMessage(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? describeConvexError(deleteError) : 'This message could not be deleted.')
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
      if (replyTo && replyTo._id === unsendTarget._id) setReplyTo(null)
      if (editingMessage && editingMessage._id === unsendTarget._id) setEditingMessage(null)
    } catch (unsendError) {
      setError(unsendError instanceof Error ? describeConvexError(unsendError) : 'This message could not be unsent.')
    } finally {
      setUnsendTarget(null)
      setActionBusy(false)
    }
  }

  async function confirmDeleteConversation() {
    if (!selectedConversationId || actionBusy) return
    setActionBusy(true)
    setError('')
    try {
      await deleteConversation({ conversationId: selectedConversationId })
      setDeleteConversationOpen(false)
      navigate({ to: '/messages', search: {} })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? describeConvexError(deleteError) : 'This conversation could not be deleted.')
      setDeleteConversationOpen(false)
    } finally {
      setActionBusy(false)
    }
  }

  if (!isSignedIn) {
    return (
      <main className="gate-state">
        <div className="gate-state-inner">
          <h1 className="text-h1 mt-2">Sign in to continue the conversation.</h1>
          <SignInButton mode="modal"><button className="btn btn-self mt-5">Sign in</button></SignInButton>
        </div>
      </main>
    )
  }

  return (
    <main className="messages-chat" data-thread-open={selectedConversationId ? 'true' : undefined} data-details-open={detailsOpen && thread ? 'true' : undefined}>
      <aside className="messages-chat-rail" aria-label="Conversations">
        <div className="messages-rail-heading">
          <h1>Messages</h1>
          <p>Private conversations and plan updates</p>
        </div>
        <ConversationList conversations={conversations} selectedConversationId={selectedConversationId} />
      </aside>
      <section className="messages-chat-pane" aria-label="Messages">
        {(notice || error) && (
          <div className={error ? 'notice notice-danger mb-4' : 'notice notice-success mb-4'} role={error ? 'alert' : 'status'}>
            <span className="notice-icon">{error ? '!' : '✓'}</span>
            <span>{error || notice}</span>
          </div>
        )}
      {conversations === undefined ? (
        <div className="empty-state">Loading conversations…</div>
      ) : conversations.length === 0 ? (
        <EmptyInbox />
      ) : selectedConversationId && thread === undefined ? (
        <div className="empty-state">Loading messages…</div>
      ) : thread ? (
        <section className="direct-thread" aria-label={`Conversation with ${thread.conversation.otherDisplayName}`}>
          <header className="direct-thread-header">
            <button
              type="button"
              className="direct-thread-back"
              aria-label="Back to conversations"
              data-tooltip="Back to conversations"
              data-tooltip-position="below-left"
              onClick={() => navigate({ to: '/messages', search: {} })}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <Avatar name={thread.conversation.otherDisplayName} src={thread.conversation.otherProfileImageUrl} decorative />
            <div className="min-w-0 direct-thread-identity">
              <div className="direct-thread-name-row">
                <h2 className="text-h2">{thread.conversation.otherDisplayName}</h2>
                {latestBookingEnded && (
                  <span className="direct-thread-booking-complete" aria-label="Booking completed" title="Booking completed">
                    <CircleCheck size={13} strokeWidth={2.4} aria-hidden="true" />
                    Completed
                  </span>
                )}
              </div>
              <p className="direct-thread-trust"><ShieldCheck size={13} aria-hidden="true" /> Private between members · Messages can be reported</p>
            </div>
            <ActionMenu
              label="Conversation options"
              panelLabel="Conversation options"
              items={[
                { label: 'Conversation details', icon: <ImageIcon size={16} aria-hidden="true" />, onSelect: () => setDetailsOpen(true) },
                { label: 'Delete conversation', icon: <Trash2 size={16} aria-hidden="true" />, tone: 'danger', onSelect: () => setDeleteConversationOpen(true) },
              ]}
            />
            <Link to="/safety" className="direct-thread-safety-link">Safety</Link>
          </header>

          <div className="direct-thread-pin-slot" data-active={currentBooking && !bookingDismissed ? 'true' : undefined}>
            {currentBooking && !bookingDismissed && (
              <ConversationBookingPin
                booking={currentBooking.booking}
                intro={currentBookingMessage?.body}
                viewerId={viewer?._id}
                history={previousBookings.map((entry) => entry.booking)}
                onDecide={async (bookingId, decision) => {
                  setError('')
                  try {
                    await decideBooking({
                      bookingId,
                      decision,
                      note: decision === 'accepted' ? 'Accepted from Messages.' : 'Declined from Messages.',
                    })
                    setNotice(decision === 'accepted' ? 'Booking request accepted.' : 'Booking request declined.')
                  } catch (decideError) {
                    setNotice('')
                    setError(decideError instanceof Error ? describeConvexError(decideError) : 'The decision could not be saved.')
                  }
                }}
                onEdit={(booking) => setEditingBooking(booking)}
                onReport={currentBookingMessage ? () => { void reportMessage(currentBookingMessage._id) } : undefined}
                onDismiss={dismissCurrentBooking}
              />
            )}
          </div>

          <div className="direct-message-list" aria-live="polite">
            {thread.messages.length === 0 && (
              <div className="direct-thread-empty">
                <MessageCircle size={24} aria-hidden="true" />
                <p>No messages yet. Say hello when you&apos;re ready.</p>
              </div>
            )}
{thread.messages.map((message, index) => (
              <Fragment key={message._id}>
                {messageDayGroupChanged(thread.messages, index) && (
                  <div className="direct-day-divider">{formatMessageDay(message.createdAt)}</div>
                )}
                {message.booking ? (
                  <div id={`message-${message._id}`} className={`booking-update-line${highlightedMessageId === String(message._id) ? ' notification-target-highlight' : ''}`} data-own={message.sentByViewer}>
                    <p>{message.body}</p>
                    <time dateTime={new Date(message.createdAt).toISOString()}>{formatMessageTime(message.createdAt)}</time>
                  </div>
                ) : (
                  <DirectMessageContent
                    id={`message-${message._id}`}
                    className={highlightedMessageId === String(message._id) ? 'notification-target-highlight' : undefined}
                    direction={message.sentByViewer ? 'outgoing' : 'incoming'}
                    attachments={message.attachments}
                    body={message.deletedAt ? 'Message deleted' : message.body}
                    createdAt={message.createdAt}
                    deleted={Boolean(message.deletedAt)}
                    editedAt={message.editedAt}
                    otherName={thread.conversation.otherDisplayName}
                    replyTo={message.replyTo}
                    status={message.sentByViewer ? 'sent' : undefined}
                    onOpenImage={setOpenImage}
                    actions={message.deletedAt ? undefined : (
                      <DirectMessageActions onOpen={() => setActionMessage(message)} />
                    )}
                  />
                )}
              </Fragment>
            ))}
            {pendingOutgoing && !thread.messages.some((message) => message._id === pendingOutgoing.messageId) && (
              <PendingOutgoingMessageBubble
                body={pendingOutgoing.body}
                attachmentNames={pendingOutgoing.attachmentNames}
                timestamp={formatMessageTime(pendingOutgoing.createdAt)}
                dateTime={new Date(pendingOutgoing.createdAt).toISOString()}
                acknowledged={Boolean(pendingOutgoing.messageId)}
              />
            )}
            <div ref={threadEndRef} />
          </div>

          {thread.conversation.otherUserSuspended ? (
            <div className="notice notice-warning">This member is not currently available for messages.</div>
          ) : (
            <MessageComposer
              key={thread.conversation._id}
              conversationId={thread.conversation._id}
              recipientName={thread.conversation.otherDisplayName}
              replyTo={replyTo ? {
                messageId: replyTo._id,
                author: replyTo.sentByViewer ? 'You' : thread.conversation.otherDisplayName,
                preview: messagePreview(replyTo),
              } : null}
              editingMessage={editingMessage ? { messageId: editingMessage._id, body: editingMessage.body } : null}
              onCancelContext={cancelComposerContext}
              onEditSaved={() => setEditingMessage(null)}
              onSending={(message) => {
                setNotice('')
                setPendingOutgoing(message)
              }}
              onSent={(messageId) => {
                setError('')
                setNotice('')
                setReplyTo(null)
                setPendingOutgoing((current) => current ? { ...current, messageId } : null)
              }}
              onSendFailed={() => setPendingOutgoing(null)}
              onError={(message) => {
                setNotice('')
                setError(message)
              }}
            />
          )}
        </section>
      ) : (
        <div className="empty-state">Choose a conversation.</div>
      )}
        <Dialog
          open={Boolean(actionMessage)}
          onClose={() => setActionMessage(null)}
          title="Message options"
          description={actionMessage?.sentByViewer
            ? 'Delete keeps a deleted notice. Unsend removes the message for both members.'
            : 'Choose an action for this message.'}
          size="small"
        >
          {actionMessage ? (
            <div className="direct-message-option-list">
              {canCompose ? (
                <button
                  type="button"
                  className="direct-message-option"
                  data-tone="social"
                  onClick={() => {
                    const target = actionMessage
                    setActionMessage(null)
                    beginReply(target)
                  }}
                >
                  <Reply size={16} aria-hidden="true" />
                  <span>Reply</span>
                </button>
              ) : null}
              {actionMessage.sentByViewer ? (
                <>
                  {canCompose ? (
                    <button
                      type="button"
                      className="direct-message-option"
                      data-tone="self"
                      onClick={() => {
                        const target = actionMessage
                        setActionMessage(null)
                        beginEdit(target)
                      }}
                    >
                      <Pencil size={16} aria-hidden="true" />
                      <span>Edit message</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="direct-message-option"
                    data-tone="danger"
                    onClick={() => {
                      const target = actionMessage
                      setActionMessage(null)
                      setDeleteTarget(target)
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    <span>Delete message</span>
                  </button>
                  <button
                    type="button"
                    className="direct-message-option"
                    data-tone="danger"
                    onClick={() => {
                      const target = actionMessage
                      setActionMessage(null)
                      setUnsendTarget(target)
                    }}
                  >
                    <EyeOff size={16} aria-hidden="true" />
                    <span>Unsend message</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="direct-message-option"
                  data-tone="danger"
                  onClick={() => {
                    const target = actionMessage
                    setActionMessage(null)
                    void reportMessage(target._id)
                  }}
                >
                  <Flag size={16} aria-hidden="true" />
                  <span>Report message</span>
                </button>
              )}
            </div>
          ) : null}
        </Dialog>
        <ConfirmationDialog
          open={Boolean(deleteTarget)}
          title="Delete message?"
          description='Both members will see "Message deleted" instead. The content stays available only for safety review.'
          confirmLabel="Delete message"
          busy={actionBusy}
          onClose={() => { if (!actionBusy) setDeleteTarget(null) }}
          onConfirm={() => { void confirmDeleteMessage() }}
        />
        <ConfirmationDialog
          open={Boolean(unsendTarget)}
          title="Unsend message?"
          description="This removes the message for both members, including the deleted notice."
          confirmLabel="Unsend message"
          busy={actionBusy}
          onClose={() => { if (!actionBusy) setUnsendTarget(null) }}
          onConfirm={() => { void confirmUnsendMessage() }}
        />
        <ConfirmationDialog
          open={deleteConversationOpen}
          title="Delete conversation?"
          description="This hides the conversation from your Messages list. The other member keeps their copy, and a new message will bring it back."
          confirmLabel="Delete conversation"
          busy={actionBusy}
          onClose={() => { if (!actionBusy) setDeleteConversationOpen(false) }}
          onConfirm={() => { void confirmDeleteConversation() }}
        />
        {editingBooking && (
          <BookingRequestEditor
            booking={editingBooking}
            companion={editingCompanion ?? undefined}
            onClose={() => setEditingBooking(null)}
            onSave={async (request) => {
              await updateBookingRequest({ bookingId: editingBooking.bookingId, ...request })
              setNotice('Request updated. The Companion will see the new details.')
              setEditingBooking(null)
            }}
          />
        )}
        {openImage && <MessageImageViewer image={openImage} onClose={() => setOpenImage(null)} />}
      </section>
      {detailsOpen && thread && (
        <ConversationDetailsSidebar
          assets={assets}
          conversation={thread.conversation}
          onClose={() => setDetailsOpen(false)}
          onOpenImage={setOpenImage}
        />
      )}
    </main>
  )
}

function DirectMessageContent({
  id,
  className,
  direction,
  attachments,
  body,
  createdAt,
  deleted = false,
  editedAt,
  otherName,
  replyTo,
  status,
  onOpenImage,
  actions,
}: {
  id?: string
  className?: string
  direction: 'incoming' | 'outgoing'
  attachments: ThreadAttachment[]
  body?: string
  createdAt: number
  deleted?: boolean
  editedAt?: number
  otherName: string
  replyTo?: ThreadReply | null
  status?: 'sent'
  onOpenImage: (image: MessageImage) => void
  actions?: ReactNode
}) {
  const images = attachments.flatMap((attachment) => (
    attachment.kind === 'image' && attachment.url
      ? [{ storageId: String(attachment.storageId), url: attachment.url, fileName: attachment.fileName }]
      : []
  ))
  const otherAttachments = attachments.filter((attachment) => attachment.kind !== 'image' || !attachment.url)
  const quote = replyTo ? (
    <blockquote className="ds-message-quote">
      <strong>{replyTo.sentByViewer ? 'You' : otherName}</strong>
      <span>
        {replyTo.deleted
          ? 'Message deleted'
          : replyTo.body || `${replyTo.attachmentCount} attachment${replyTo.attachmentCount === 1 ? '' : 's'}`}
      </span>
    </blockquote>
  ) : undefined

  return (
    <MessageBubble
      id={id}
      className={className}
      direction={direction}
      body={body}
      timestamp={`${formatMessageTime(createdAt)}${editedAt ? ' · Edited' : ''}`}
      dateTime={new Date(createdAt).toISOString()}
      status={status}
      quote={quote}
      media={images.length > 0 ? <MessageImageGallery images={images} onOpen={onOpenImage} /> : undefined}
      attachments={otherAttachments.length > 0 ? <MessageAttachments attachments={otherAttachments} /> : undefined}
      actions={actions}
      data-deleted={deleted || undefined}
    />
  )
}

function DirectMessageActions({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="direct-message-options"
      aria-label="Message options"
      aria-haspopup="dialog"
      data-tooltip="Message options"
      data-tooltip-position="above"
      onClick={onOpen}
    >
      <Ellipsis size={16} aria-hidden="true" />
    </button>
  )
}

function ConversationDetailsSidebar({ assets, conversation, onClose, onOpenImage }: {
  assets: ConversationAssets | undefined
  conversation: Thread['conversation']
  onClose: () => void
  onOpenImage: (image: MessageImage) => void
}) {
  const media = assets?.media ?? []
  const images = media.flatMap((item) => (item.kind === 'image' && item.url
    ? [{ storageId: String(item.storageId), url: item.url, fileName: item.fileName }]
    : []))
  const videos = media.filter((item) => item.kind === 'video' && item.url)
  const files = media.filter((item) => item.kind === 'file' && item.url)
  const links = assets?.links ?? []

  return (
    <aside className="direct-details-sidebar" aria-label="Conversation details">
      <div className="direct-details-heading">
        <Avatar name={conversation.otherDisplayName} src={conversation.otherProfileImageUrl} decorative />
        <div className="min-w-0">
          <h2 className="text-h3">Conversation details</h2>
          <p className="text-meta">{conversation.otherDisplayName}</p>
        </div>
        <button type="button" className="direct-details-close" aria-label="Close conversation details" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <section className="direct-details-section">
        <h3>Photos and videos <span>{images.length + videos.length}</span></h3>
        {assets === undefined ? <p className="text-meta">Loading shared media…</p> : images.length || videos.length ? (
          <>
            {images.length ? <MessageImageGallery images={images} onOpen={onOpenImage} /> : null}
            {videos.map((video) => (
              <a key={video.storageId} className="direct-details-row" href={video.url ?? undefined} target="_blank" rel="noreferrer">
                <Video size={16} aria-hidden="true" />
                <span>{video.fileName}</span>
              </a>
            ))}
          </>
        ) : <p className="text-meta">No photos or videos shared yet.</p>}
      </section>

      <section className="direct-details-section">
        <h3>Files <span>{files.length}</span></h3>
        {assets === undefined ? null : files.length ? files.map((file) => (
          <button
            key={file.storageId}
            type="button"
            className="direct-details-row direct-details-download"
            aria-label={`Download attachment ${file.fileName}`}
            onClick={() => { if (file.url) void downloadAttachment(file.url, file.fileName) }}
          >
            <FileText size={16} aria-hidden="true" />
            <span><strong>{file.fileName}</strong><small>{formatFileSize(file.size)} · Download file</small></span>
          </button>
        )) : <p className="text-meta">No files shared yet.</p>}
      </section>

      <section className="direct-details-section">
        <h3>Links <span>{links.length}</span></h3>
        {assets === undefined ? null : links.length ? links.map((link) => (
          <a key={link.url} className="direct-details-row" href={link.url} target="_blank" rel="noreferrer">
            <Link2 size={16} aria-hidden="true" />
            <span>{link.url}</span>
          </a>
        )) : <p className="text-meta">No links shared yet.</p>}
      </section>
    </aside>
  )
}

function messagePreview(message: ThreadMessage) {
  if (message.deletedAt) return 'Message deleted'
  const body = message.body.trim()
  if (body) return body
  const count = message.attachments.length
  if (count === 1) return '1 attachment'
  if (count > 1) return `${count} attachments`
  return 'Message'
}

function MessageAttachments({ attachments }: { attachments: ThreadAttachment[] }) {
  return (
    <div className="direct-attachment-grid" data-count={attachments.length}>
      {attachments.map((attachment) => {
        if (attachment.kind === 'video' && attachment.url) {
          return (
            <div key={attachment.storageId} className="direct-attachment-media">
              <video src={attachment.url} controls playsInline preload="metadata" aria-label={attachment.fileName} />
              <AttachmentMeta attachment={attachment} />
            </div>
          )
        }
        const url = attachment.url
        return (
          <button
            key={attachment.storageId}
            type="button"
            className="direct-attachment-file"
            aria-label={`Download attachment ${attachment.fileName}`}
            disabled={!url}
            onClick={() => { if (url) void downloadAttachment(url, attachment.fileName) }}
          >
            <FileText size={20} aria-hidden="true" />
            <span><strong>{attachment.fileName}</strong><small>{url ? `${formatFileSize(attachment.size)} · Download file` : 'Secure link unavailable'}</small></span>
          </button>
        )
      })}
    </div>
  )
}

function AttachmentMeta({ attachment }: { attachment: ThreadAttachment }) {
  return (
    <span className="direct-attachment-meta">
      <span>{attachment.fileName}</span>
      <small>{formatFileSize(attachment.size)}{attachment.compressionPercent > 0 ? ` · ${attachment.compressionPercent}% smaller` : ''}</small>
    </span>
  )
}

function MessageComposer({
  conversationId,
  recipientName,
  replyTo,
  editingMessage,
  onCancelContext,
  onEditSaved,
  onSending,
  onSent,
  onSendFailed,
  onError,
}: {
  conversationId: Id<'directConversations'>
  recipientName: string
  replyTo: { messageId: Id<'directMessages'>; author: string; preview: string } | null
  editingMessage: { messageId: Id<'directMessages'>; body: string } | null
  onCancelContext: () => void
  onEditSaved: () => void
  onSending: (message: PendingOutgoingMessage) => void
  onSent: (messageId: Id<'directMessages'>) => void
  onSendFailed: () => void
  onError: (message: string) => void
}) {
  const generateUpload = useMutation(api.conversations.generateAttachmentUploadUrl)
  const registerUpload = useMutation(api.conversations.registerAttachmentUpload)
  const discardUpload = useMutation(api.conversations.discardAttachmentUpload)
  const sendMessage = useMutation(api.conversations.sendMessage)
  const editMessage = useMutation(api.conversations.editMessage)
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [sending, setSending] = useState(false)
  const attachmentRef = useRef(attachments)
  const cancelledRef = useRef<Set<string>>(new Set())
  const mountedRef = useRef(true)
  const sendingRef = useRef(false)
  const previousEditingRef = useRef<Id<'directMessages'> | null>(null)
  attachmentRef.current = attachments

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cancelledRef.current.clear()
      attachmentRef.current.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
      })
    }
  }, [])

  const editingId = editingMessage?.messageId ?? null
  const editingBody = editingMessage?.body ?? ''

  useEffect(() => {
    if (editingId) {
      setBody(editingBody)
      attachmentRef.current.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
      })
      setAttachments([])
    } else if (previousEditingRef.current) {
      setBody('')
    }
    previousEditingRef.current = editingId
  }, [editingBody, editingId])

  const removeAttachment = (id: string) => {
    if (sendingRef.current) return
    const removed = attachmentRef.current.find((attachment) => attachment.id === id)
    if (removed?.status === 'preparing') cancelledRef.current.add(id)
    else cancelledRef.current.delete(id)
    setAttachments((current) => {
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return current.filter((attachment) => attachment.id !== id)
    })
  }

  const addFiles = async (files: File[]) => {
    if (sendingRef.current) return
    const available = MAX_CHAT_ATTACHMENTS - attachments.length
    if (available <= 0) {
      onError('Messages can include up to 4 files.')
      return
    }
    const accepted = files.slice(0, available)
    if (files.length > available) onError('Only the first available files were added. Messages can include up to 4 files.')
    const pending = accepted.map((source) => ({
      id: crypto.randomUUID(),
      source,
      progress: 0,
      status: 'preparing' as const,
    }))
    setAttachments((current) => [...current, ...pending])

    for (const item of pending) {
      if (!mountedRef.current) break
      if (cancelledRef.current.delete(item.id)) continue
      try {
        const prepared = await prepareChatAttachment(item.source, (progress) => {
          if (!mountedRef.current || cancelledRef.current.has(item.id) || !attachmentRef.current.some((attachment) => attachment.id === item.id)) return
          setAttachments((current) => current.map((attachment) => attachment.id === item.id ? { ...attachment, progress } : attachment))
        })
        const previewUrl = prepared.kind === 'image' || prepared.kind === 'video' ? URL.createObjectURL(prepared.file) : undefined
        if (!mountedRef.current || cancelledRef.current.has(item.id)) {
          if (previewUrl) URL.revokeObjectURL(previewUrl)
          continue
        }
        setAttachments((current) => current.map((attachment) => attachment.id === item.id
          ? { ...attachment, prepared, previewUrl, progress: 100, status: 'ready' }
          : attachment))
      } catch (caught) {
        if (!mountedRef.current || cancelledRef.current.has(item.id)) continue
        const message = caught instanceof Error ? describeConvexError(caught) : 'File could not be prepared.'
        setAttachments((current) => current.map((attachment) => attachment.id === item.id
          ? { ...attachment, status: 'error', error: message }
          : attachment))
        onError(message)
      } finally {
        cancelledRef.current.delete(item.id)
      }
    }
  }

  const hasPending = attachments.some((attachment) => attachment.status === 'preparing')
  const hasErrors = attachments.some((attachment) => attachment.status === 'error')
  const canSend = editingMessage
    ? Boolean(body.trim()) && !sending
    : Boolean(body.trim() || attachments.length > 0) && !hasPending && !hasErrors && !sending

  const send = async () => {
    if (sendingRef.current || !canSend) return
    if (editingMessage) {
      sendingRef.current = true
      setSending(true)
      onError('')
      try {
        await editMessage({ messageId: editingMessage.messageId, body: body.trim() })
        setBody('')
        onEditSaved()
      } catch (caught) {
        onError(caught instanceof Error ? describeConvexError(caught) : 'Message could not be saved.')
      } finally {
        setSending(false)
        sendingRef.current = false
      }
      return
    }
    sendingRef.current = true
    setSending(true)
    onError('')
    onSending({
      body: body.trim(),
      attachmentNames: attachments.map((attachment) => attachment.source.name),
      createdAt: Date.now(),
    })
    const grants: Array<{ uploadId: Id<'directMessageUploads'>; storageId?: Id<'_storage'>; claimed?: boolean }> = []
    try {
      for (const attachment of attachments) {
        if (!attachment.prepared) throw new Error('Wait for every file to finish preparing.')
        const grant = await generateUpload({})
        const tracked = { uploadId: grant.uploadId, storageId: undefined as Id<'_storage'> | undefined, claimed: false }
        grants.push(tracked)
        const response = await fetch(grant.uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': attachment.prepared.file.type },
          body: attachment.prepared.file,
        })
        if (!response.ok) throw new Error(`${attachment.source.name} could not be uploaded.`)
        const result = await response.json() as { storageId: Id<'_storage'> }
        tracked.storageId = result.storageId
        await registerUpload({
          uploadId: grant.uploadId,
          storageId: result.storageId,
          fileName: attachment.prepared.file.name,
          originalSize: attachment.prepared.originalSize,
          compressionPercent: attachment.prepared.compressionPercent,
        })
      }
      const messageId = await sendMessage({
        conversationId,
        body,
        attachmentUploadIds: grants.map((grant) => grant.uploadId),
        replyToMessageId: replyTo?.messageId,
      })
      grants.forEach((grant) => { grant.claimed = true })
      attachments.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
      })
      setAttachments([])
      setBody('')
      onSent(messageId)
    } catch (caught) {
      await Promise.allSettled(grants.filter((grant) => !grant.claimed).map((grant) => discardUpload({
        uploadId: grant.uploadId,
        storageId: grant.storageId,
      })))
      onSendFailed()
      onError(caught instanceof Error ? describeConvexError(caught) : 'Message could not be sent.')
    } finally {
      setSending(false)
      sendingRef.current = false
    }
  }

  return (
    <div className="direct-composer-shell">
      {editingMessage || replyTo ? (
        <div className="direct-composer-context" data-mode={editingMessage ? 'edit' : 'reply'}>
          <div className="direct-composer-context-copy">
            <strong>{editingMessage ? 'Editing message' : `Replying to ${replyTo?.author}`}</strong>
            <span>{editingMessage ? editingBody : replyTo?.preview}</span>
          </div>
          <button
            type="button"
            className="direct-composer-context-cancel"
            aria-label={editingMessage ? 'Cancel editing message' : 'Cancel reply'}
            onClick={onCancelContext}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <CompactComposer
        variant="thread"
        value={body}
        placeholder={`Message ${recipientName}`}
        canSubmit={canSend}
        sending={sending}
        preparing={hasPending}
        submitLabel={editingMessage ? 'Save changes' : 'Send'}
        attachments={attachments.length > 0 ? attachments.map((attachment) => (
          <AttachmentMetaRow
            key={attachment.id}
            leading={<AttachmentPreview attachment={attachment} />}
            name={attachment.source.name}
            detail={attachment.status === 'preparing'
              ? 'Compressing media before upload'
              : attachment.status === 'error'
                ? attachment.error
                : attachment.prepared?.compressionPercent
                  ? `${attachment.prepared.compressionPercent}% smaller · ${formatFileSize(attachment.prepared.file.size)} from ${formatFileSize(attachment.prepared.originalSize)}`
                  : `Original · ${formatFileSize(attachment.source.size)}`}
            state={attachment.status === 'preparing'
              ? `${attachment.progress}%`
              : attachment.status === 'error'
                ? 'Preparation failed'
                : 'Ready'}
            stateTone={attachment.status === 'preparing'
              ? 'progress'
              : attachment.status === 'error'
                ? 'danger'
                : 'success'}
            action={(
              <button type="button" className="ds-compact-composer-remove" onClick={() => removeAttachment(attachment.id)} disabled={sending} aria-label={`Remove ${attachment.source.name}`} data-tooltip="Remove attachment" data-tooltip-position="above">
                <X size={14} aria-hidden="true" />
              </button>
            )}
          />
        )) : undefined}
        onFilesSelected={editingMessage ? undefined : (files) => { void addFiles(files) }}
        attachDisabled={attachments.length >= MAX_CHAT_ATTACHMENTS}
        onChange={setBody}
        onSubmit={() => { void send() }}
        hint={editingMessage
          ? <>Save to update this message · Attachments stay unchanged</>
          : <>Press Enter to send · Shift+Enter for a new line · Large media is compressed automatically</>}
      />
    </div>
  )
}

function AttachmentPreview({ attachment }: { attachment: PendingAttachment }) {
  if (attachment.status === 'preparing') return <LoaderCircle className="direct-spinner" size={18} aria-hidden="true" />
  if (attachment.previewUrl && attachment.prepared?.kind === 'image') return <img src={attachment.previewUrl} alt="" />
  if (attachment.prepared?.kind === 'video') return <Video size={18} aria-hidden="true" />
  if (attachment.prepared?.kind === 'image') return <ImageIcon size={18} aria-hidden="true" />
  return <FileText size={18} aria-hidden="true" />
}

function ConversationList({
  conversations,
  selectedConversationId,
}: {
  conversations: Conversation[] | undefined
  selectedConversationId?: Id<'directConversations'>
}) {
  return (
    <div className="conversation-rail">
      <div className="rail-section-label">Recent</div>
      {conversations === undefined && <p className="text-meta px-2">Loading…</p>}
      {conversations?.length === 0 && <p className="text-meta px-2">No conversations yet.</p>}
      {conversations?.map((conversation) => (
        <Link
          key={conversation._id}
          to="/messages"
          search={{ conversationId: conversation._id }}
          className="conversation-rail-link"
          aria-current={conversation._id === selectedConversationId ? 'page' : undefined}
        >
          <ConversationListItemContent
            name={conversation.otherDisplayName}
            imageUrl={conversation.otherProfileImageUrl}
            preview={conversationPreview(conversation)}
            timeLabel={conversation.lastMessageCreatedAt === undefined ? undefined : formatConversationListTime(conversation.lastMessageCreatedAt)}
            dateTime={conversation.lastMessageCreatedAt === undefined ? undefined : new Date(conversation.lastMessageCreatedAt).toISOString()}
            unreadCount={conversation.unreadCount}
            suspended={conversation.otherUserSuspended}
          />
        </Link>
      ))}
      <Link to="/nearby" className="btn btn-social btn-sm mt-3">Find people</Link>
    </div>
  )
}

function EmptyInbox() {
  return (
    <div className="empty-state direct-inbox-empty">
      <MessageCircle size={28} aria-hidden="true" />
      <p className="empty-state-title">Your conversations will appear here.</p>
      <p className="text-meta">Open someone’s profile or a community post when you are ready to say hello.</p>
      <div className="flex gap-2 justify-center mt-4">
        <Link to="/nearby" className="btn btn-social btn-sm">Explore people</Link>
        <Link to="/social" className="btn btn-neutral btn-sm">See community posts</Link>
      </div>
    </div>
  )
}

function formatMessageTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}

async function downloadAttachment(url: string, fileName: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('The file could not be downloaded.')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function conversationPreview(conversation: Conversation) {
  const viewerPrefix = conversation.lastMessageSentByViewer ? 'You: ' : ''
  if (conversation.lastMessageDeleted) return `${viewerPrefix}Message deleted`
  if (conversation.lastMessageBody) return `${viewerPrefix}${conversation.lastMessageBody}`
  if (conversation.lastMessageAttachmentCount === 1) return `${viewerPrefix}Sent a file`
  if (conversation.lastMessageAttachmentCount > 1) return `${viewerPrefix}Sent ${conversation.lastMessageAttachmentCount} files`
  return 'Start a conversation'
}

function formatConversationListTime(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()
  const time = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(date)
  if (date.toDateString() === today.toDateString()) return time
  const day = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date)
  return `${day} · ${time}`
}

function messageDayGroupChanged(messages: Array<{ createdAt: number }>, index: number) {
  if (index === 0) return true
  return new Date(messages[index - 1].createdAt).toDateString() !== new Date(messages[index].createdAt).toDateString()
}

function formatMessageDay(timestamp: number) {
  const startOfDay = (value: number) => new Date(value).setHours(0, 0, 0, 0)
  const daysAgo = Math.round((startOfDay(Date.now()) - startOfDay(timestamp)) / 86400000)
  if (daysAgo === 0) return 'Today'
  if (daysAgo === 1) return 'Yesterday'
  return new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }).format(timestamp)
}
