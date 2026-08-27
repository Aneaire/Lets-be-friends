import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import {
  NotificationRow,
  type NotificationRowTone,
} from '@/design-system/molecules/NotificationRow'
import { StateView } from '@/design-system/molecules/StateView'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { Screen } from '@/design-system/templates/Screen'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export type NotificationCenterItem = {
  id: string
  title: string
  body?: string
  timeLabel: string
  tone?: NotificationRowTone
  unread: boolean
  group: 'attention' | 'new' | 'earlier'
}

type BusyAction = { id: string; action: 'open' | 'toggle' } | null

export function NotificationCenterPresentation({
  notifications,
  loadingFirstPage = false,
  pagination = 'complete',
  onBack,
  onMarkAllRead,
  onOpen,
  onToggleRead,
  onLoadMore,
}: {
  notifications: NotificationCenterItem[]
  loadingFirstPage?: boolean
  pagination?: 'can_load_more' | 'loading_more' | 'complete'
  onBack: () => void
  onMarkAllRead: () => void | Promise<unknown>
  onOpen: (notification: NotificationCenterItem) => void | Promise<void>
  onToggleRead: (notification: NotificationCenterItem) => void | Promise<unknown>
  onLoadMore: () => void
}) {
  const theme = useAppTheme()
  const [busy, setBusy] = useState<BusyAction>(null)
  const [markAllBusy, setMarkAllBusy] = useState(false)
  const [error, setError] = useState('')
  const hasUnread = notifications.some((notification) => notification.unread)
  const sections = [
    { id: 'attention', title: 'Needs your attention' },
    { id: 'new', title: 'New' },
    { id: 'earlier', title: 'Earlier' },
  ] as const

  async function runItem(
    notification: NotificationCenterItem,
    action: 'open' | 'toggle',
  ) {
    if (busy || markAllBusy) return
    setBusy({ id: notification.id, action })
    setError('')
    try {
      if (action === 'open') await onOpen(notification)
      else await onToggleRead(notification)
    } catch {
      setError('The notification could not be updated. Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  async function markAllRead() {
    if (!hasUnread || busy || markAllBusy) return
    setMarkAllBusy(true)
    setError('')
    try {
      await onMarkAllRead()
    } catch {
      setError('Notifications could not be marked read. Check your connection and try again.')
    } finally {
      setMarkAllBusy(false)
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        back
        onBack={onBack}
        title="Notifications"
        subtitle="Booking, social, account, and safety updates"
        action={(
          <IconButton
            label={markAllBusy
              ? 'Marking all notifications read'
              : 'Mark all notifications read'}
            icon="checkmark-done-outline"
            tone="self"
            disabled={!hasUnread || busy !== null}
            loading={markAllBusy}
            onPress={() => void markAllRead()}
          />
        )}
      />

      {error ? <InlineNotice title="Notification update failed" tone="danger">{error}</InlineNotice> : null}

      {loadingFirstPage ? (
        <StateView
          embedded
          loading
          title="Loading notifications"
          detail="Booking, social, account, and safety updates will appear here."
          intent="self"
        />
      ) : notifications.length === 0 ? (
        <StateView
          embedded
          eyebrow="UPDATES"
          title="You are all caught up"
          detail="New booking, social, account, and safety updates will appear here."
          intent="self"
        />
      ) : (
        <>
          {sections.map((section) => {
            const items = notifications.filter(
              (notification) => notification.group === section.id,
            )
            if (!items.length) return null

            return (
              <View key={section.id} style={styles.section}>
                <AppText variant="label" color={theme.colors.textMuted}>
                  {section.title.toUpperCase()}
                </AppText>
                <View style={styles.list}>
                  {items.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      title={notification.title}
                      body={notification.body}
                      timeLabel={notification.timeLabel}
                      tone={notification.tone}
                      density="compact"
                      unread={notification.unread}
                      disabled={markAllBusy || (busy !== null && busy.id !== notification.id)}
                      openBusy={busy?.id === notification.id && busy.action === 'open'}
                      toggleBusy={busy?.id === notification.id && busy.action === 'toggle'}
                      onOpen={() => runItem(notification, 'open')}
                      onToggleRead={() => runItem(notification, 'toggle')}
                    />
                  ))}
                </View>
              </View>
            )
          })}
          <View style={styles.loadMore}>
            {pagination === 'can_load_more' ? (
              <ActionButton
                label="Load more notifications"
                onPress={onLoadMore}
                intent="self"
                secondary
              />
            ) : pagination === 'loading_more' ? (
              <AppText
                accessibilityRole="text"
                accessibilityLiveRegion="polite"
                variant="caption"
                color={theme.colors.textMuted}>
                Loading more notifications.
              </AppText>
            ) : (
              <AppText variant="caption" color={theme.colors.textMuted}>
                All loaded notifications are shown.
              </AppText>
            )}
          </View>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: density.screenBottom },
  section: { gap: density.cardGap, marginTop: density.sectionGap },
  list: { gap: 0 },
  loadMore: { alignItems: 'center', paddingVertical: density.contentGap },
})
