import type { HTMLAttributes, ReactNode } from 'react'
import { Bell } from 'lucide-react'
import { Avatar } from '../atoms/Avatar'

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
  actor?: { displayName: string; profileImageUrl?: string }
}

export function NotificationItemContent({
  title,
  body,
  timeLabel,
  dateTime,
  density = 'comfortable',
  unread = false,
  tone = 'neutral',
  actor,
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
      <span className="ds-notification-item-visual" aria-hidden="true">
        {actor
          ? <Avatar name={actor.displayName} src={actor.profileImageUrl} size="small" decorative />
          : <span className="ds-notification-system-icon"><Bell size={15} /></span>}
        <span className="ds-notification-item-marker" />
      </span>
      <span className="ds-notification-item-copy">
        <strong className="ds-notification-item-title">{title}</strong>
        {body ? <span className="ds-notification-item-body">{body}</span> : null}
        {timeLabel ? <time className="ds-notification-item-time" dateTime={dateTime}>{timeLabel}</time> : null}
      </span>
    </span>
  )
}
