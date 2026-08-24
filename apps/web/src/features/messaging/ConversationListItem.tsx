import { Avatar } from '../../design-system/atoms/Avatar'

export function ConversationListItemContent({
  name,
  imageUrl,
  preview,
  timeLabel,
  dateTime,
  unreadCount = 0,
  suspended = false,
}: {
  name: string
  imageUrl?: string | null
  preview: string
  timeLabel?: string
  dateTime?: string
  unreadCount?: number
  suspended?: boolean
}) {
  return (
    <>
      <Avatar name={name} src={imageUrl ?? undefined} decorative />
      <span className="min-w-0">
        <strong>{name}</strong>
        <span>{suspended ? 'Messaging unavailable' : preview}</span>
      </span>
      <span className="conversation-card-trailing">
        {timeLabel ? <time dateTime={dateTime}>{timeLabel}</time> : null}
        {unreadCount > 0 ? (
          <span
            className="conversation-unread-badge tabular"
            aria-label={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}
          >
            {unreadCount}
          </span>
        ) : null}
      </span>
    </>
  )
}
