import { SignInButton, useAuth } from '@clerk/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { Bell, CheckCheck } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button } from '../design-system/atoms/Button'
import { InfiniteScrollTrigger } from '../design-system/molecules/InfiniteScrollTrigger'
import { NotificationRow } from '../design-system/molecules/NotificationRow'
import { formatNotificationTime, notificationSection, webDestination, type NotificationDestination } from '../lib/notifications'

export const Route = createFileRoute('/notifications')({
  component: NotificationsPage,
  errorComponent: NotificationsError,
})

type Notification = ReturnType<typeof usePaginatedQuery<typeof api.notifications.list>>['results'][number]

export function NotificationsPage() {
  const { isSignedIn } = useAuth()
  const notificationPage = usePaginatedQuery(api.notifications.list, isSignedIn ? {} : 'skip', { initialNumItems: 30 })
  const notifications = notificationPage.results as Notification[]
  const openNotification = useMutation(api.notifications.open)
  const markRead = useMutation(api.notifications.markRead)
  const markUnread = useMutation(api.notifications.markUnread)
  const markAllRead = useMutation(api.notifications.markAllRead)
  const navigate = useNavigate()

  if (!isSignedIn) {
    return <main className="notifications-page"><div className="notifications-empty"><Bell size={28} aria-hidden="true" /><h1 className="text-h1">Sign in to view notifications</h1><SignInButton mode="modal"><Button intent="self">Sign in</Button></SignInButton></div></main>
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
        <Button intent="neutral" size="small" leadingIcon={<CheckCheck size={16} aria-hidden="true" />} disabled={!notifications.some((item) => !item.readAt)} onClick={() => void markAllRead()}>Mark all as read</Button>
      </header>
      {notificationPage.status === 'LoadingFirstPage' ? <div className="notifications-empty" role="status">Loading notifications...</div> : notifications.length === 0 ? (
        <div className="notifications-empty"><Bell size={28} aria-hidden="true" /><h2 className="text-h2">You are all caught up</h2><p className="text-meta">New booking, social, account, and safety updates will appear here.</p></div>
      ) : <>{sections.map((section) => {
        const items = notifications.filter((notification) => notificationSection(notification) === section.id)
        if (!items.length) return null
        return <section className="notification-section" key={section.id}><h2>{section.title}</h2><div className="notification-list">{items.map((notification) => (
          <NotificationRow
            key={notification.id}
            title={notification.title}
            body={notification.body}
            timeLabel={formatNotificationTime(notification.createdAt)}
            dateTime={new Date(notification.createdAt).toISOString()}
            tone={notification.tone}
            actor={notification.actor}
            unread={!notification.readAt}
            onOpen={async () => {
              const result = await openNotification({ notificationId: notification.id })
              if (result.status === 'ready') await navigate(webDestination(result.destination as NotificationDestination) as never)
            }}
            onToggle={async () => notification.readAt
              ? markUnread({ notificationId: notification.id as Id<'notifications'> })
              : markRead({ notificationId: notification.id as Id<'notifications'> })}
          />
        ))}</div></section>
      })}<InfiniteScrollTrigger
          status={notificationPage.status}
          onLoadMore={() => notificationPage.loadMore(30)}
          loadingLabel="Loading more notifications..."
          className="notifications-load-more"
        /></>}
    </main>
  )
}

function NotificationsError({ reset }: { reset: () => void }) {
  return <main className="notifications-page"><div className="notifications-empty" role="alert"><Bell size={28} aria-hidden="true" /><h1 className="text-h1">Notifications could not be loaded</h1><p className="text-meta">Please try again. No notification details are shown in this error.</p><Button intent="neutral" onClick={reset}>Try again</Button></div></main>
}
