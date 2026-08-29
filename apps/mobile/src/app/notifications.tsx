import { useMutation, usePaginatedQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { StyleSheet } from 'react-native'

import { mobileApi } from '@/backend/client'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { mobileNotificationRoute, notificationAge, notificationGroup, type MobileNotificationDestination } from '@/data/notifications'
import { NotificationCenterPresentation } from '@/features/notifications/NotificationCenterPresentation'
import { useMobileMember } from '@/member/MobileMember'

export default function NotificationsScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <NotificationState title="Sign in to view notifications" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <NotificationState title="Notifications need account services" detail="Connect your account to load personal notification activity." />
  if (member.status === 'unavailable' || member.status === 'error') return <NotificationState title="Notifications are unavailable" detail={member.message} />
  if (member.status !== 'ready') return <PageSkeleton variant="notifications" />
  return <ReadyNotifications />
}

function ReadyNotifications() {
  const notificationPage = usePaginatedQuery(
    mobileApi.notifications.list,
    {},
    { initialNumItems: 30 },
  )
  const notifications = notificationPage.results
  const markRead = useMutation(mobileApi.notifications.markRead)
  const markUnread = useMutation(mobileApi.notifications.markUnread)
  const markAllRead = useMutation(mobileApi.notifications.markAllRead)
  const items = notifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    timeLabel: notificationAge(notification.createdAt),
    tone: notification.tone,
    unread: !notification.readAt,
    group: notificationGroup(notification),
  }))

  return (
    <NotificationCenterPresentation
      notifications={items}
      loadingFirstPage={notificationPage.status === 'LoadingFirstPage'}
      pagination={notificationPage.status === 'CanLoadMore'
        ? 'can_load_more'
        : notificationPage.status === 'LoadingMore'
          ? 'loading_more'
          : 'complete'}
      onBack={() => router.back()}
      onMarkAllRead={() => markAllRead()}
      onOpen={async (notification) => {
        const source = notifications.find((item) => item.id === notification.id)
        if (!source) return
        if (!source.readAt) {
          await markRead({ notificationId: source.id as never })
        }
        router.push(
          mobileNotificationRoute(
            source.destination as MobileNotificationDestination,
          ) as never,
        )
      }}
      onToggleRead={(notification) => {
        const source = notifications.find((item) => item.id === notification.id)
        if (!source) return Promise.resolve()
        return source.readAt
          ? markUnread({ notificationId: source.id as never })
          : markRead({ notificationId: source.id as never })
      }}
      onLoadMore={() => notificationPage.loadMore(30)}
    />
  )
}

function NotificationState({
  title,
  detail,
  action,
  onPress,
  loading = false,
}: {
  title: string
  detail?: string
  action?: string
  onPress?: () => void
  loading?: boolean
}) {
  return (
    <Screen contentStyle={styles.fullState}>
      <StateView
        loading={loading}
        title={title}
        detail={detail}
        actionLabel={action}
        onAction={onPress}
        intent="self"
      />
    </Screen>
  )
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <NotificationState title="Notifications could not be loaded" detail="Please try again." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  fullState: { flexGrow: 1, justifyContent: 'center' },
})
