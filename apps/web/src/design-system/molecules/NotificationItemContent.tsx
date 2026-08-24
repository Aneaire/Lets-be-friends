import type { HTMLAttributes, ReactNode } from 'react'

export type NotificationItemTone = 'neutral' | 'self' | 'social' | 'danger'
export type NotificationItemDensity = 'compact' | 'comfortable'

export type NotificationItemContentProps = Omit<HTMLAttributes<HTMLSpanElement>, 'title'> & {
  title: ReactNode
  body?: ReactNode
  timeLabel?: ReactNode
  dateTime?: string
  density?: NotificationItemDensity
  unread?: boolean
  tone?: NotificationItemTone
}

export function NotificationItemContent({
  title,
  body,
  timeLabel,
  dateTime,
  density = 'comfortable',
  unread = false,
  tone = 'neutral',
  className = '',
  ...props
}: NotificationItemContentProps) {
  return (
    <span
      {...props}
      className={`ds-notification-item-content ${className}`.trim()}
      data-density={density}
      data-tone={tone}
      data-unread={unread}
    >
      {unread ? <span className="sr-only">Unread notification</span> : null}
      <span className="ds-notification-item-marker" aria-hidden="true" />
      <span className="ds-notification-item-copy">
        <strong className="ds-notification-item-title">{title}</strong>
        {body ? <span className="ds-notification-item-body">{body}</span> : null}
        {timeLabel ? <time className="ds-notification-item-time" dateTime={dateTime}>{timeLabel}</time> : null}
      </span>
    </span>
  )
}
