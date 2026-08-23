import { SignInButton, useAuth } from '@clerk/react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowLeft, CircleCheck, FileText, Flag, Image as ImageIcon, LoaderCircle, MessageCircle, Paperclip, Send, ShieldCheck, Video, X } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { BookingRequestCard } from '../features/booking/BookingRequestCard'
import { BookingRequestEditor, type EditableBookingRequest } from '../features/booking/BookingRequestEditor'
import { MessageDeliveryStatus } from '../design-system/atoms/MessageDeliveryStatus'
import { Avatar } from '../design-system/atoms/Avatar'
import { MessageImageGallery, MessageImageViewer, type MessageImage } from '../design-system/molecules/MessageImages'
import {
  MAX_CHAT_ATTACHMENTS,
  formatFileSize,
  prepareChatAttachment,
  type PreparedChatAttachment,
} from '../lib/chatAttachments'
import { bookingMessagePresentation } from '../lib/messageBookings'

export const Route = createFileRoute('/messages')({
  validateSearch: (search: Record<string, unknown>): { conversationId?: string } => (
    typeof search.conversationId === 'string' ? { conversationId: search.conversationId } : {}
  ),
  component: MessagesPage,
})

type Conversation = NonNullable<ReturnType<typeof useQuery<typeof api.conversations.list>>>[number]
type Thread = NonNullable<ReturnType<typeof useQuery<typeof api.conversations.messages>>>
type ThreadAttachment = Thread['messages'][number]['attachments'][number]
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

function MessagesPage() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()
  const { conversationId } = Route.useSearch()
  const conversations = useQuery(api.conversations.list, isSignedIn ? {} : 'skip') as Conversation[] | undefined
  const viewer = useQuery(api.users.viewer, isSignedIn ? {} : 'skip')
  const selectedConversationId = conversationId ? conversationId as Id<'directConversations'> : undefined
  const thread = useQuery(
    api.conversations.messages,
    isSignedIn && selectedConversationId ? { conversationId: selectedConversationId } : 'skip',
  )
  const { lastIndexByBookingId: bookingLastIndex, floatingBookingIndex, latestBookingStatus } = bookingMessagePresentation(thread?.messages ?? [])
  const latestBookingEnded = latestBookingStatus === 'completed' || latestBookingStatus === 'review_window' || latestBookingStatus === 'closed'
  const report = useMutation(api.reports.create)
  const decideBooking = useMutation(api.bookings.companionDecision)
  const updateBookingRequest = useMutation(api.bookings.editRequest)
  const markRead = useMutation(api.conversations.markRead)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [pendingOutgoing, setPendingOutgoing] = useState<PendingOutgoingMessage | null>(null)
  const [editingBooking, setEditingBooking] = useState<EditableBookingRequest | null>(null)
  const [openImage, setOpenImage] = useState<MessageImage | null>(null)
  const editingCompanion = useQuery(api.companions.getPublic, editingBooking?.companionProfileId ? { companionProfileId: editingBooking.companionProfileId } : 'skip')
  const threadEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [pendingOutgoing, thread?.messages.length])

  useEffect(() => {
    setPendingOutgoing(null)
  }, [selectedConversationId])

  useEffect(() => {
    if (isSignedIn && selectedConversationId) {
      void markRead({ conversationId: selectedConversationId })
    }
  }, [isSignedIn, markRead, selectedConversationId])

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
    <main className="messages-chat" data-thread-open={selectedConversationId ? 'true' : undefined}>
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
            <Link to="/safety" className="direct-thread-safety-link">Safety</Link>
          </header>

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
                {message.booking && bookingLastIndex.get(message.booking.bookingId) !== index ? (
                  <div className="booking-update-line" data-own={message.sentByViewer}>
                    <p>{message.body}</p>
                    <time dateTime={new Date(message.createdAt).toISOString()}>{formatMessageTime(message.createdAt)}</time>
                  </div>
                ) : message.booking ? (
                  <article
                    className="direct-booking"
                    data-own={message.sentByViewer}
                    data-floating={index === floatingBookingIndex ? 'true' : undefined}
                  >
                    <BookingRequestCard
                      intro={message.body}
                      booking={message.booking}
                      viewerId={viewer?._id}
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
                          setError(decideError instanceof Error ? decideError.message : 'The decision could not be saved.')
                        }
                      }}
                      onEdit={(booking) => setEditingBooking(booking)}
                    />
                    <button
                      type="button"
                      className="direct-message-report"
                      aria-label="Report message"
                      title="Report message"
                      onClick={async () => {
                        setError('')
                        try {
                          await report({ targetType: 'message', targetId: message._id, reason: 'Message needs safety review' })
                          setNotice('Message sent to safety review.')
                        } catch (reportError) {
                          setNotice('')
                          setError(reportError instanceof Error ? reportError.message : 'Message could not be reported.')
                        }
                      }}
                    >
                      <Flag size={14} aria-hidden="true" />
                    </button>
                  </article>
                ) : (
                  <article className="direct-message" data-own={message.sentByViewer}>
                    <DirectMessageContent
                      attachments={message.attachments}
                      body={message.body}
                      createdAt={message.createdAt}
                      onOpenImage={setOpenImage}
                    />
                    {message.sentByViewer && <MessageDeliveryStatus state="sent" />}
                    <button
                      type="button"
                      className="direct-message-report"
                      aria-label="Report message"
                      title="Report message"
                      onClick={async () => {
                        setError('')
                        try {
                          await report({ targetType: 'message', targetId: message._id, reason: 'Message needs safety review' })
                          setNotice('Message sent to safety review.')
                        } catch (reportError) {
                          setNotice('')
                          setError(reportError instanceof Error ? reportError.message : 'Message could not be reported.')
                        }
                      }}
                    >
                      <Flag size={14} aria-hidden="true" />
                    </button>
                  </article>
                )}
              </Fragment>
            ))}
            {pendingOutgoing && !thread.messages.some((message) => message._id === pendingOutgoing.messageId) && (
              <article className="direct-message" data-own="true" data-pending="true">
                <div className="direct-message-bubble">
                  {pendingOutgoing.body && <p className="direct-message-copy whitespace-pre-wrap">{pendingOutgoing.body}</p>}
                  {pendingOutgoing.attachmentNames.length > 0 && (
                    <p className="direct-message-pending-files">{pendingOutgoing.attachmentNames.join(', ')}</p>
                  )}
                  <time dateTime={new Date(pendingOutgoing.createdAt).toISOString()}>{formatMessageTime(pendingOutgoing.createdAt)}</time>
                </div>
                <MessageDeliveryStatus state={pendingOutgoing.messageId ? 'sent' : 'sending'} />
              </article>
            )}
            <div ref={threadEndRef} />
          </div>

          {thread.conversation.otherUserSuspended ? (
            <div className="notice notice-warning">This member is not currently available for messages.</div>
          ) : (
            <MessageComposer
              conversationId={thread.conversation._id}
              recipientName={thread.conversation.otherDisplayName}
              onSending={(message) => {
                setNotice('')
                setPendingOutgoing(message)
              }}
              onSent={(messageId) => {
                setError('')
                setNotice('')
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
    </main>
  )
}

function DirectMessageContent({
  attachments,
  body,
  createdAt,
  onOpenImage,
}: {
  attachments: ThreadAttachment[]
  body?: string
  createdAt: number
  onOpenImage: (image: MessageImage) => void
}) {
  const images = attachments.flatMap((attachment) => (
    attachment.kind === 'image' && attachment.url
      ? [{ storageId: String(attachment.storageId), url: attachment.url, fileName: attachment.fileName }]
      : []
  ))
  const otherAttachments = attachments.filter((attachment) => attachment.kind !== 'image' || !attachment.url)
  const hasBubble = Boolean(body || otherAttachments.length > 0)

  return (
    <div className="direct-message-content" data-images={images.length > 0 ? 'true' : undefined}>
      {images.length > 0 && <MessageImageGallery images={images} onOpen={onOpenImage} />}
      {hasBubble && (
        <div className="direct-message-bubble">
          {otherAttachments.length > 0 && <MessageAttachments attachments={otherAttachments} />}
          {body && <p className="direct-message-copy whitespace-pre-wrap">{body}</p>}
          {images.length === 0 && <time dateTime={new Date(createdAt).toISOString()}>{formatMessageTime(createdAt)}</time>}
        </div>
      )}
      {images.length > 0 && (
        <time className="direct-message-media-time" dateTime={new Date(createdAt).toISOString()}>{formatMessageTime(createdAt)}</time>
      )}
    </div>
  )
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
        return (
          <a key={attachment.storageId} href={attachment.url ?? undefined} download={attachment.fileName} className="direct-attachment-file">
            <FileText size={20} aria-hidden="true" />
            <span><strong>{attachment.fileName}</strong><small>{formatFileSize(attachment.size)}</small></span>
          </a>
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
  onSending,
  onSent,
  onSendFailed,
  onError,
}: {
  conversationId: Id<'directConversations'>
  recipientName: string
  onSending: (message: PendingOutgoingMessage) => void
  onSent: (messageId: Id<'directMessages'>) => void
  onSendFailed: () => void
  onError: (message: string) => void
}) {
  const generateUpload = useMutation(api.conversations.generateAttachmentUploadUrl)
  const registerUpload = useMutation(api.conversations.registerAttachmentUpload)
  const discardUpload = useMutation(api.conversations.discardAttachmentUpload)
  const sendMessage = useMutation(api.conversations.sendMessage)
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentRef = useRef(attachments)
  attachmentRef.current = attachments

  useEffect(() => () => {
    attachmentRef.current.forEach((attachment) => {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
    })
  }, [])

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const removed = current.find((attachment) => attachment.id === id)
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return current.filter((attachment) => attachment.id !== id)
    })
  }

  const addFiles = async (files: File[]) => {
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
      try {
        const prepared = await prepareChatAttachment(item.source, (progress) => {
          setAttachments((current) => current.map((attachment) => attachment.id === item.id ? { ...attachment, progress } : attachment))
        })
        const previewUrl = prepared.kind === 'image' || prepared.kind === 'video' ? URL.createObjectURL(prepared.file) : undefined
        setAttachments((current) => current.map((attachment) => attachment.id === item.id
          ? { ...attachment, prepared, previewUrl, progress: 100, status: 'ready' }
          : attachment))
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'File could not be prepared.'
        setAttachments((current) => current.map((attachment) => attachment.id === item.id
          ? { ...attachment, status: 'error', error: message }
          : attachment))
        onError(message)
      }
    }
  }

  const hasPending = attachments.some((attachment) => attachment.status === 'preparing')
  const hasErrors = attachments.some((attachment) => attachment.status === 'error')
  const canSend = Boolean(body.trim() || attachments.length > 0) && !hasPending && !hasErrors && !sending

  return (
    <form
      className="direct-message-composer"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!canSend) return
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
          })
          grants.forEach((grant) => { grant.claimed = true })
          attachments.forEach((attachment) => {
            if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
          })
          setAttachments([])
          setBody('')
          if (fileInputRef.current) fileInputRef.current.value = ''
          onSent(messageId)
        } catch (caught) {
          await Promise.allSettled(grants.filter((grant) => !grant.claimed).map((grant) => discardUpload({
            uploadId: grant.uploadId,
            storageId: grant.storageId,
          })))
          onSendFailed()
          onError(caught instanceof Error ? caught.message : 'Message could not be sent.')
        } finally {
          setSending(false)
        }
      }}
    >
      {attachments.length > 0 && (
        <div className="direct-composer-tray" aria-label="Selected files">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="direct-composer-file" data-state={attachment.status}>
              <AttachmentPreview attachment={attachment} />
              <span className="min-w-0">
                <strong>{attachment.source.name}</strong>
                <small>
                  {attachment.status === 'preparing'
                    ? `Compressing · ${attachment.progress}%`
                    : attachment.status === 'error'
                      ? attachment.error
                      : attachment.prepared?.compressionPercent
                        ? `${attachment.prepared.compressionPercent}% smaller · ${formatFileSize(attachment.prepared.file.size)} from ${formatFileSize(attachment.prepared.originalSize)}`
                        : `Original · ${formatFileSize(attachment.source.size)}`}
                </small>
              </span>
              <button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.source.name}`}>
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="direct-composer-controls">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          accept="image/*,video/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          onChange={(event) => {
            void addFiles(Array.from(event.currentTarget.files ?? []))
            event.currentTarget.value = ''
          }}
        />
        <button type="button" className="direct-attach-button" onClick={() => fileInputRef.current?.click()} disabled={sending || attachments.length >= MAX_CHAT_ATTACHMENTS} aria-label="Attach files" title="Attach files">
          <Paperclip size={18} aria-hidden="true" />
        </button>
        <textarea
          name="body"
          className="field"
          rows={1}
          maxLength={2000}
          value={body}
          onChange={(event) => setBody(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={`Message ${recipientName}`}
          aria-label="Message"
        />
        <button className="btn btn-social direct-send-button" disabled={!canSend}>
          {sending || hasPending ? <LoaderCircle className="direct-spinner" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          <span>{sending ? 'Sending…' : hasPending ? 'Preparing…' : 'Send'}</span>
        </button>
      </div>
      <p className="direct-composer-hint">Press Enter to send · Shift+Enter for a new line · Large media is compressed automatically</p>
    </form>
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
          <Avatar name={conversation.otherDisplayName} src={conversation.otherProfileImageUrl} decorative />
          <span className="min-w-0">
            <strong>{conversation.otherDisplayName}</strong>
            <span>{conversation.lastMessageBody
              ? `${conversation.lastMessageSentByViewer ? 'You: ' : ''}${conversation.lastMessageBody}`
              : conversation.lastMessageAttachmentCount > 0
                ? `${conversation.lastMessageSentByViewer ? 'You: ' : ''}${conversation.lastMessageAttachmentCount === 1 ? 'Sent a file' : `Sent ${conversation.lastMessageAttachmentCount} files`}`
                : 'Start a conversation'}</span>
          </span>
          <span className="conversation-card-trailing">
            {conversation.lastMessageCreatedAt !== undefined && (
              <time dateTime={new Date(conversation.lastMessageCreatedAt).toISOString()}>
                {formatConversationListTime(conversation.lastMessageCreatedAt)}
              </time>
            )}
            {conversation.unreadCount > 0 && (
              <span className="conversation-unread-badge tabular" aria-label={`${conversation.unreadCount} unread message${conversation.unreadCount === 1 ? '' : 's'}`}>
                {conversation.unreadCount}
              </span>
            )}
          </span>
        </Link>
      ))}
      <Link to="/discover" className="btn btn-social btn-sm mt-3">Find people</Link>
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
        <Link to="/discover" className="btn btn-social btn-sm">Explore people</Link>
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
