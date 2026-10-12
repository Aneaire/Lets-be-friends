import type { ReactNode } from 'react'
import { Modal, Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

import {
  VIDEO_VIEWER_CLOSE_LABEL,
  VIDEO_VIEWER_RETRY_LABEL,
  resolveVideoViewerAccessibilityLabel,
} from './videoPresentation'

export type VideoViewerShellProps = {
  title: string
  error: string | null
  onClose: () => void
  onRetry: () => void
  closeLabel?: string
  retryLabel?: string
  children: ReactNode
}

export function VideoViewerShell({
  title,
  error,
  onClose,
  onRetry,
  closeLabel = VIDEO_VIEWER_CLOSE_LABEL,
  retryLabel = VIDEO_VIEWER_RETRY_LABEL,
  children,
}: VideoViewerShellProps) {
  const theme = useAppTheme()
  const insets = useSafeAreaInsets()
  const viewerLabel = resolveVideoViewerAccessibilityLabel(title)

  return (
    <Modal
      visible
      transparent={false}
      animationType={Platform.OS === 'web' ? 'none' : 'fade'}
      accessibilityLabel={viewerLabel}
      onRequestClose={onClose}
    >
      <View
        accessible={Platform.OS !== 'web'}
        role={Platform.OS === 'web' ? undefined : 'dialog'}
        accessibilityLabel={Platform.OS === 'web' ? undefined : viewerLabel}
        accessibilityViewIsModal={Platform.OS === 'web' ? undefined : true}
        onAccessibilityEscape={onClose}
        style={[styles.viewer, { backgroundColor: theme.colors.background }]}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: Math.max(12, insets.top + 8),
              paddingBottom: Math.max(12, insets.bottom + 8),
              paddingLeft: Math.max(12, insets.left + 8),
              paddingRight: Math.max(12, insets.right + 8),
            },
          ]}
        >
          <View style={[styles.toolbar, { backgroundColor: theme.colors.surface }]}>
            <AppText
              variant="title"
              color={theme.colors.text}
              numberOfLines={1}
              style={styles.title}
            >
              {title}
            </AppText>
            <IconButton
              label={closeLabel}
              icon="close"
              onPress={onClose}
              style={{ backgroundColor: theme.colors.surfaceRaised }}
            />
          </View>
          <View style={styles.videoSlot}>{children}</View>
          {error ? (
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={[styles.error, { backgroundColor: theme.colors.surfaceRaised }]}
            >
              <AppText variant="body" style={styles.errorMessage}>
                {error}
              </AppText>
              <ActionButton
                label={retryLabel}
                intent="neutral"
                secondary
                compact
                icon="refresh-outline"
                onPress={onRetry}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  viewer: { flex: 1 },
  content: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12 },
  title: { flex: 1 },
  videoSlot: { flex: 1, marginTop: 12, overflow: 'hidden' },
  error: { marginTop: 12, borderRadius: 12, padding: 12, gap: 8 },
  errorMessage: { flexShrink: 1 },
})
