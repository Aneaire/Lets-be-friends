import type { FunctionReturnType } from 'convex/server'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { Screen } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import { mobileNotificationRoute, notificationAge, notificationGroup, type MobileNotificationDestination } from '@/data/notifications'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type Notification = FunctionReturnType<typeof mobileApi.notifications.list>['page'][number]

export default function NotificationsScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <NotificationState title="Sign in to view notifications" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'demo') return <NotificationState title="Live notifications are unavailable in demo mode" detail="Demo content does not represent a real unread state." />
  if (member.status === 'unavailable' || member.status === 'error') return <NotificationState title="Notifications are unavailable" detail={member.message} />
  if (member.status !== 'ready') return <NotificationState title="Loading notifications" />
  return <ReadyNotifications />
}

function ReadyNotifications() {
  const theme = useAppTheme()
  const notificationPage = usePaginatedQuery(mobileApi.notifications.list, {}, { initialNumItems: 30 })
  const notifications = notificationPage.results
  const markRead = useMutation(mobileApi.notifications.markRead)
  const markUnread = useMutation(mobileApi.notifications.markUnread)
  const markAllRead = useMutation(mobileApi.notifications.markAllRead)
  const sections = [
    { id: 'attention', title: 'Needs your attention' },
    { id: 'new', title: 'New' },
    { id: 'earlier', title: 'Earlier' },
  ] as const

  return <Screen contentStyle={styles.content}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}><AppText variant="label">BACK</AppText></Pressable>
      <Pressable disabled={!notifications.some((item) => !item.readAt)} accessibilityRole="button" accessibilityLabel="Mark all notifications read" onPress={() => void markAllRead()}><AppText variant="label" color={theme.colors.textMuted}>MARK ALL READ</AppText></Pressable>
    </View>
    <View style={styles.title}><AppText variant="display">Notifications</AppText><AppText color={theme.colors.textMuted}>Booking, social, account, and safety updates.</AppText></View>
    {notificationPage.status === 'LoadingFirstPage' ? <NotificationState title="Loading notifications" embedded /> : notifications.length === 0 ? <NotificationState title="You are all caught up" detail="New updates will appear here." embedded /> : <>{sections.map((section) => {
      const items = notifications.filter((item) => notificationGroup(item) === section.id)
      if (!items.length) return null
      return <View key={section.id} style={styles.section}><AppText variant="label" color={theme.colors.textMuted}>{section.title.toUpperCase()}</AppText>{items.map((notification) => <NotificationRow key={notification.id} notification={notification} onOpen={async () => {
        if (!notification.readAt) await markRead({ notificationId: notification.id as never })
        router.push(mobileNotificationRoute(notification.destination as MobileNotificationDestination) as never)
      }} onToggle={() => notification.readAt ? markUnread({ notificationId: notification.id as never }) : markRead({ notificationId: notification.id as never })} />)}</View>
    })}<View style={styles.loadMore}>{notificationPage.status === 'CanLoadMore' ? <ActionButton label="Load more" onPress={() => notificationPage.loadMore(30)} secondary /> : notificationPage.status === 'LoadingMore' ? <AppText variant="caption" color={theme.colors.textMuted}>Loading more notifications.</AppText> : <AppText variant="caption" color={theme.colors.textMuted}>All loaded notifications are shown.</AppText>}</View></>}
  </Screen>
}

function NotificationRow({ notification, onOpen, onToggle }: { notification: Notification; onOpen: () => Promise<void>; onToggle: () => Promise<unknown> }) {
  const theme = useAppTheme()
  const tone = notification.tone === 'social' ? theme.colors.social : notification.tone === 'self' ? theme.colors.self : notification.tone === 'danger' ? theme.colors.danger : theme.colors.text
  return <View style={[styles.row, { borderColor: theme.colors.border, backgroundColor: notification.readAt ? theme.colors.background : theme.colors.surface }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${notification.title}. ${notification.body}`} onPress={() => void onOpen()} style={styles.rowMain}>
      <View style={[styles.dot, { borderColor: theme.colors.borderStrong, backgroundColor: notification.readAt ? 'transparent' : theme.colors.text }]} />
      <View style={styles.copy}><AppText variant="bodyStrong" color={tone}>{notification.title}</AppText><AppText variant="caption" color={theme.colors.textMuted}>{notification.body}</AppText><AppText variant="caption" color={theme.colors.textMuted}>{notificationAge(notification.createdAt)}</AppText></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={notification.readAt ? 'Mark notification unread' : 'Mark notification read'} onPress={() => void onToggle()}><AppText variant="caption" color={theme.colors.textMuted}>{notification.readAt ? 'Mark unread' : 'Mark read'}</AppText></Pressable>
  </View>
}

function NotificationState({ title, detail, action, onPress, embedded = false }: { title: string; detail?: string; action?: string; onPress?: () => void; embedded?: boolean }) {
  const theme = useAppTheme()
  const content = <View style={styles.state}><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} intent="self" /> : null}</View>
  return embedded ? content : <Screen contentStyle={styles.fullState}>{content}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <NotificationState title="Notifications could not be loaded" detail="Please try again." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48 },
  header: { paddingTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { gap: 8, paddingVertical: 28 },
  section: { gap: 10, marginBottom: 28 },
  row: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 10 },
  rowMain: { flexDirection: 'row', gap: 12 },
  dot: { width: 8, height: 8, borderWidth: 1, borderRadius: 4, marginTop: 7 },
  copy: { flex: 1, gap: 3 },
  loadMore: { alignItems: 'center', paddingVertical: 16 },
  state: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  fullState: { flexGrow: 1, justifyContent: 'center' },
})
