import { MessageBubble } from './MessageBubble'

export function PendingOutgoingMessageBubble({
  body,
  attachmentNames,
  timestamp,
  dateTime,
  acknowledged = false,
}: {
  body: string
  attachmentNames: string[]
  timestamp: string
  dateTime: string
  acknowledged?: boolean
}) {
  return (
    <MessageBubble
      direction="outgoing"
      body={body || undefined}
      timestamp={timestamp}
      dateTime={dateTime}
      status={acknowledged ? 'sent' : 'sending'}
      pending
      attachments={attachmentNames.length > 0 ? (
        <p className="ds-message-attachment-names">
          {attachmentNames.join(', ')}
        </p>
      ) : undefined}
    />
  )
}
