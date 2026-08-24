import { useState } from 'react'

import {
  NotificationItemContent,
  type NotificationItemTone,
} from './NotificationItemContent'

export type NotificationRowProps = {
  title: string
  body?: string
  timeLabel: string
  dateTime: string
  tone?: NotificationItemTone
  unread: boolean
  onOpen: () => Promise<void>
  onToggle: () => Promise<unknown>
}

export function NotificationRow({
  title,
  body,
  timeLabel,
  dateTime,
  tone = 'neutral',
  unread,
  onOpen,
  onToggle,
}: NotificationRowProps) {
  const [busy, setBusy] = useState<'open' | 'toggle' | null>(null)
  const [error, setError] = useState('')

  async function run(
    action: 'open' | 'toggle',
    callback: () => Promise<unknown>,
  ) {
    if (busy) return
    setBusy(action)
    setError('')
    try {
      await callback()
    } catch {
      setError('The notification could not be updated. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <article className="notification-row" data-unread={unread}>
      <button
        type="button"
        className="notification-row-main"
        aria-label={`Open notification: ${title}`}
        aria-busy={busy === 'open' || undefined}
        disabled={busy !== null}
        onClick={() => void run('open', onOpen)}>
        <NotificationItemContent
          title={title}
          body={body}
          timeLabel={timeLabel}
          dateTime={dateTime}
          tone={tone}
          unread={unread}
        />
      </button>
      <button
        type="button"
        className="notification-read-action"
        aria-label={unread ? `Mark ${title} read` : `Mark ${title} unread`}
        aria-busy={busy === 'toggle' || undefined}
        disabled={busy !== null}
        onClick={() => void run('toggle', onToggle)}>
        {busy === 'toggle'
          ? 'Updating…'
          : unread
            ? 'Mark read'
            : 'Mark unread'}
      </button>
      {error ? (
        <p className="notification-row-error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  )
}
