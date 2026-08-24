import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export type AttachmentMetaRowState = 'default' | 'progress' | 'success' | 'danger'

export type AttachmentMetaRowProps = {
  name: string
  detail?: string
  state?: AttachmentMetaRowState
  leading?: ReactNode
  actionLabel?: string
  actionRole?: 'button' | 'link'
  onAction?: () => void | Promise<void>
  disabled?: boolean
  busy?: boolean
}

export function AttachmentMetaRow({
  name,
  detail,
  state = 'default',
  leading,
  actionLabel,
  actionRole = 'button',
  onAction,
  disabled = false,
  busy = false,
}: AttachmentMetaRowProps) {
  const theme = useAppTheme()
  const stateColor = state === 'progress'
    ? theme.colors.socialText
    : state === 'success'
      ? theme.colors.success
      : state === 'danger'
        ? theme.colors.danger
        : theme.colors.textMuted
  const inactive = disabled || busy
  const content = (
    <>
      <View style={styles.leading}>
        {leading ?? <AppIcon name="document-outline" size={20} color={stateColor} />}
      </View>
      <View style={styles.copy}>
        <AppText variant="bodyStrong" numberOfLines={2}>{name}</AppText>
        {detail ? <AppText variant="caption" color={stateColor} numberOfLines={2}>{detail}</AppText> : null}
      </View>
    </>
  )

  if (!onAction) {
    return <View style={[styles.row, { borderTopColor: theme.colors.border }]}>{content}</View>
  }

  return (
    <Pressable
      accessibilityRole={actionRole}
      accessibilityLabel={actionLabel ?? [name, detail].filter(Boolean).join('. ')}
      accessibilityState={{ disabled: inactive, busy }}
      aria-busy={busy || undefined}
      disabled={inactive}
      onPress={() => void onAction()}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: theme.colors.border },
        pressed && styles.pressed,
        inactive && styles.disabled,
      ]}>
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    minHeight: density.compactControlHeight,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: density.textSectionGap,
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: density.cardGap,
  },
  leading: { width: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: density.textPairGap },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.52 },
})
