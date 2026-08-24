import { Pressable, StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
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
  const openLabel = [unread ? 'Unread notification.' : undefined, title, body, timeLabel]
    .filter(Boolean)
    .join(' ')
  const toggleLabel = unread ? 'Mark notification read' : 'Mark notification unread'
  const inactive = disabled || openBusy || toggleBusy

  return (
    <View style={[
      styles.row,
      density === 'compact' ? styles.compact : styles.comfortable,
      { borderBottomColor: theme.colors.border, backgroundColor: unread ? theme.colors.surface : theme.colors.background },
    ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={openLabel}
        accessibilityState={{ disabled: inactive, busy: openBusy }}
        aria-busy={openBusy || undefined}
        disabled={inactive}
        onPress={() => void onOpen()}
        style={({ pressed }) => [styles.main, pressed && styles.pressed, inactive && styles.disabled]}>
        <View
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.dot,
            { borderColor: theme.colors.borderStrong, backgroundColor: unread ? theme.colors.text : 'transparent' },
          ]}
        />
        <View style={styles.copy}>
          <AppText variant="bodyStrong" color={titleColor}>{title}</AppText>
          {body ? <AppText variant="caption" color={theme.colors.textMuted}>{body}</AppText> : null}
          {timeLabel ? <AppText variant="caption" color={theme.colors.textMuted}>{timeLabel}</AppText> : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={toggleLabel}
        accessibilityState={{ disabled: inactive, busy: toggleBusy }}
        aria-busy={toggleBusy || undefined}
        disabled={inactive}
        onPress={() => void onToggleRead()}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed, inactive && styles.disabled]}>
        <AppText variant="caption" color={theme.colors.textMuted}>{unread ? 'Mark read' : 'Mark unread'}</AppText>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: StyleSheet.hairlineWidth },
  comfortable: { padding: densityTokens.cardPadding, gap: densityTokens.cardGap },
  compact: { padding: densityTokens.compactCardPadding, gap: densityTokens.textStackGap },
  main: { minHeight: densityTokens.compactControlHeight, minWidth: 0, flexDirection: 'row', gap: densityTokens.compactCardPadding },
  dot: { width: 8, height: 8, borderWidth: 1, borderRadius: 4, marginTop: 7 },
  copy: { flex: 1, minWidth: 0, gap: densityTokens.textPairGap },
  toggle: {
    minHeight: densityTokens.compactControlHeight,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: densityTokens.cardGap,
    marginHorizontal: -densityTokens.cardGap,
  },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.52 },
})
