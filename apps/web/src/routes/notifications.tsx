import { SignInButton, useAuth } from '@clerk/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { Bell, CheckCheck } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { formatNotificationTime, notificationSection, webDestination, type NotificationDestination } from '../lib/notifications'

export const Route = createFileRoute('/notifications')({
  component: NotificationsPage,
  errorComponent: NotificationsError,
})

type Notification = ReturnType<typeof usePaginatedQuery<typeof api.notifications.list>>['results'][number]

function NotificationsPage() {
  const { isSignedIn } = useAuth()
  const notificationPage = usePaginatedQuery(api.notifications.list, isSignedIn ? {} : 'skip', { initialNumItems: 30 })
  const notifications = notificationPage.results as Notification[]
  const markRead = useMutation(api.notifications.markRead)
  const markUnread = useMutation(api.notifications.markUnread)
  const markAllRead = useMutation(api.notifications.markAllRead)
  const navigate = useNavigate()

  if (!isSignedIn) {
    return <main className="notifications-page"><div className="notifications-empty"><Bell size={28} /><h1 className="text-h1">Sign in to view notifications</h1><SignInButton mode="modal"><button className="btn btn-self">Sign in</button></SignInButton></div></main>
  }

  const sections = [
    { id: 'attention', title: 'Needs your attention' },
    { id: 'new', title: 'New' },
    { id: 'earlier', title: 'Earlier' },
  ] as const

  return (
    <main className="notifications-page">
      <header className="notifications-page-header">
        <div><span className="text-label">IN-APP UPDATES</span><h1 className="text-h1">Notifications</h1><p className="text-meta">Booking, social, account, and safety updates in one calm timeline.</p></div>
        <button className="btn btn-neutral btn-sm" disabled={!notifications.some((item) => !item.readAt)} onClick={() => void markAllRead()}><CheckCheck size={16} />Mark all as read</button>
      </header>
      {notificationPage.status === 'LoadingFirstPage' ? <div className="notifications-empty" role="status">Loading notifications...</div> : notifications.length === 0 ? (
        <div className="notifications-empty"><Bell size={28} /><h2 className="text-h2">You are all caught up</h2><p className="text-meta">New booking, social, account, and safety updates will appear here.</p></div>
      ) : <>{sections.map((section) => {
        const items = notifications.filter((notification) => notificationSection(notification) === section.id)
        if (!items.length) return null
        return <section className="notification-section" key={section.id}><h2>{section.title}</h2><div className="notification-list">{items.map((notification) => (
          <NotificationRow
            key={notification.id}
            notification={notification}
            onOpen={async () => {
              if (!notification.readAt) await markRead({ notificationId: notification.id as Id<'notifications'> })
              const destination = webDestination(notification.destination as NotificationDestination)
              await navigate(destination as never)
            }}
            onToggle={async () => notification.readAt
              ? markUnread({ notificationId: notification.id as Id<'notifications'> })
              : markRead({ notificationId: notification.id as Id<'notifications'> })}
          />
        ))}</div></section>
      })}<div className="notifications-load-more">{notificationPage.status === 'CanLoadMore' ? <button className="btn btn-neutral" onClick={() => notificationPage.loadMore(30)}>Load more</button> : notificationPage.status === 'LoadingMore' ? <span role="status" className="text-meta">Loading more notifications...</span> : <span className="text-meta">All loaded notifications are shown.</span>}</div></>}
    </main>
  )
}

function NotificationsError({ reset }: { reset: () => void }) {
  return <main className="notifications-page"><div className="notifications-empty" role="alert"><Bell size={28} /><h1 className="text-h1">Notifications could not be loaded</h1><p className="text-meta">Please try again. No notification details are shown in this error.</p><button className="btn btn-neutral" onClick={reset}>Try again</button></div></main>
}

function NotificationRow({ notification, onOpen, onToggle }: { notification: Notification; onOpen: () => Promise<void>; onToggle: () => Promise<unknown> }) {
  return <article className="notification-row" data-unread={!notification.readAt} data-tone={notification.tone}>
    <button type="button" className="notification-row-main" onClick={() => void onOpen()}>
      <span className="notification-dot" aria-hidden="true" />
      <span className="notification-copy"><strong>{notification.title}</strong><span>{notification.body}</span><small>{formatNotificationTime(notification.createdAt)}</small></span>
    </button>
    <button type="button" className="notification-read-action" onClick={() => void onToggle()} aria-label={notification.readAt ? `Mark ${notification.title} unread` : `Mark ${notification.title} read`}>{notification.readAt ? 'Mark unread' : 'Mark read'}</button>
  </article>
}
