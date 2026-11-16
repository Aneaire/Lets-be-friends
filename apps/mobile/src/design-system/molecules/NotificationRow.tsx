import { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { notificationReadAction } from '@/data/notifications'
import { AppText } from '@/design-system/atoms/Typography'
import { ActionSheet } from '@/design-system/molecules/ActionSheet'
import { NotificationVisual, type NotificationActor } from '@/design-system/molecules/NotificationVisual'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density as densityTokens } from '@/theme/tokens'

export type NotificationRowTone = 'neutral' | 'self' | 'social' | 'danger'
export type NotificationRowDensity = 'compact' | 'comfortable'

export type NotificationRowProps = {
  title: string
  body?: string
  timeLabel?: string
  tone?: NotificationRowTone
  density?: NotificationRowDensity
  kind?: string
  actors?: NotificationActor[]
  unread?: boolean
  disabled?: boolean
  openBusy?: boolean
  toggleBusy?: boolean
  onOpen: () => void | Promise<void>
  onToggleRead: () => void | Promise<unknown>
}

export function NotificationRow({
  title,
  body,
  timeLabel,
  tone = 'neutral',
  density = 'comfortable',
  kind,
  actors,
  unread = false,
  disabled = false,
  openBusy = false,
  toggleBusy = false,
  onOpen,
  onToggleRead,
}: NotificationRowProps) {
  const theme = useAppTheme()
  const titleColor = tone === 'social'
    ? theme.colors.socialText
    : tone === 'self'
      ? theme.colors.selfText
      : tone === 'danger'
        ? theme.colors.danger
        : theme.colors.text
  const rowBackground = unread ? theme.colors.surface : theme.colors.background
  const shownActorNames = (actors ?? [])
    .map((actor) => actor.displayName)
    .filter(Boolean)
    .slice(0, 3)
  const additionalActorNames = shownActorNames
    .slice(1)
    .filter((name) => !body?.includes(name))
  const openLabel = [
    unread ? 'Unread notification.' : undefined,
    title,
    body,
    additionalActorNames.length ? `Also: ${additionalActorNames.join(', ')}.` : undefined,
    timeLabel,
  ]
    .filter(Boolean)
    .join(' ')
  const readAction = notificationReadAction(unread)
  const inactive = disabled || openBusy || toggleBusy
  const [optionsOpen, setOptionsOpen] = useState(false)
  const longPressHandled = useRef(false)

  function openNotification() {
    if (longPressHandled.current) {
      longPressHandled.current = false
      return
    }
    void onOpen()
  }

  function showOptions() {
    longPressHandled.current = true
    setOptionsOpen(true)
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={openLabel}
        accessibilityHint={`Tap to open. Touch and hold to ${readAction.label.toLowerCase()}.`}
        accessibilityState={{ disabled: inactive, busy: openBusy }}
        aria-busy={openBusy || undefined}
        disabled={inactive}
        delayLongPress={450}
        onPress={openNotification}
        onLongPress={showOptions}
        onPressOut={() => {
          if (longPressHandled.current) setTimeout(() => { longPressHandled.current = false }, 0)
        }}
        style={({ pressed }) => [
          styles.row,
          density === 'compact' ? styles.compact : styles.comfortable,
          { borderBottomColor: theme.colors.border, backgroundColor: rowBackground },
          pressed && styles.pressed,
          inactive && styles.disabled,
        ]}>
        <NotificationVisual
          actors={actors}
          kind={kind}
          tone={tone}
          size={density === 'compact' ? 38 : 42}
          ringColor={rowBackground}
        />
        <View style={styles.copy}>
          <AppText variant="bodyStrong" color={titleColor}>{title}</AppText>
          {body ? <AppText variant="caption" color={theme.colors.textMuted}>{body}</AppText> : null}
          {timeLabel ? <AppText variant="caption" color={theme.colors.textMuted}>{timeLabel}</AppText> : null}
        </View>
        {unread ? (
          <View
            importantForAccessibility="no-hide-descendants"
            style={[styles.dot, { backgroundColor: theme.colors.text }]}
          />
        ) : null}
      </Pressable>
      <ActionSheet
        visible={optionsOpen}
        title="Notification options"
        description={title}
        items={[{
          label: readAction.label,
          icon: readAction.icon,
          onPress: () => void onToggleRead(),
        }]}
        busy={toggleBusy}
        onClose={() => setOptionsOpen(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: densityTokens.compactControlHeight, minWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-start' },
  comfortable: { paddingVertical: densityTokens.cardPadding, paddingHorizontal: densityTokens.cardPadding, gap: densityTokens.compactCardPadding },
  compact: { paddingVertical: densityTokens.compactCardPadding, paddingHorizontal: densityTokens.cardPadding, gap: densityTokens.cardGap },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  copy: { flex: 1, minWidth: 0, gap: densityTokens.textPairGap },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.52 },
})
