import type { ReactNode } from 'react'
import { MessageDeliveryStatus } from '../../design-system/atoms/MessageDeliveryStatus'

export function MessageBubble({ direction, body, timestamp, status, pending = false, attachments, actions }: {
  direction: 'incoming' | 'outgoing'
  body?: string
  timestamp: string
  status?: 'sending' | 'sent'
  pending?: boolean
  attachments?: ReactNode
  actions?: ReactNode
}) {
  return (
    <article className="ds-message" data-direction={direction} data-pending={pending || undefined}>
      <div className="ds-message-content">
        <div className="ds-message-bubble">
          {attachments}
          {body ? <p>{body}</p> : null}
          <time>{timestamp}</time>
        </div>
        {direction === 'outgoing' && status ? <MessageDeliveryStatus state={status} /> : null}
      </div>
      {actions ? <div className="ds-message-actions">{actions}</div> : null}
    </article>
  )
}
