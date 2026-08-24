import type { ReactNode } from 'react'

import { MessageDeliveryStatus } from '../../design-system/atoms/MessageDeliveryStatus'

export function MessageBubble({
  direction,
  body,
  timestamp,
  dateTime,
  status,
  pending = false,
  media,
  attachments,
  actions,
}: {
  direction: 'incoming' | 'outgoing'
  body?: string
  timestamp: string
  dateTime?: string
  status?: 'sending' | 'sent'
  pending?: boolean
  media?: ReactNode
  attachments?: ReactNode
  actions?: ReactNode
}) {
  const hasMedia = Boolean(media)
  const hasBubble = Boolean(body || attachments || !hasMedia)
  const messageTime = <time dateTime={dateTime}>{timestamp}</time>

  return (
    <article
      className="ds-message"
      data-direction={direction}
      data-pending={pending || undefined}
      data-media={hasMedia || undefined}
    >
      <div className="ds-message-content">
        {media ? <div className="ds-message-media">{media}</div> : null}
        {hasBubble ? (
          <div className="ds-message-bubble">
            {attachments}
            {body ? <p>{body}</p> : null}
            {!hasMedia ? messageTime : null}
          </div>
        ) : null}
        {hasMedia ? <div className="ds-message-metadata">{messageTime}</div> : null}
        {direction === 'outgoing' && status ? (
          <MessageDeliveryStatus state={status} />
        ) : null}
      </div>
      {actions ? <div className="ds-message-actions">{actions}</div> : null}
    </article>
  )
}
