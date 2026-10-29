import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import {
  chatAttachmentKind,
  type ChatAttachmentKind,
  type PendingChatAttachment,
} from '@/data/chatAttachments'
import { formatFileSize } from '@/data/messageViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density, radii } from '@/theme/tokens'

import { PendingVideoThumbnail } from './PendingVideoThumbnail'

const PENDING_TILE_SIZE = 76
const SENT_TILE_SIZE = 148
const OVERLAY_SCRIM = 'rgba(12, 12, 12, 0.62)'
const OVERLAY_ICON = '#FFFFFF'

export function PendingAttachmentTray({ attachments, onRemove, disabled = false }: {
  attachments: PendingChatAttachment[]
  onRemove: (attachmentId: string) => void
  disabled?: boolean
}) {
  const theme = useAppTheme()
  const firstError = attachments.find((attachment) => attachment.status === 'error')

  return (
    <View style={styles.tray}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trayRow}
        keyboardShouldPersistTaps="handled">
        {attachments.map((attachment) => {
          const kind = chatAttachmentKind(attachment.mimeType)
          const failed = attachment.status === 'error'
          return (
            <View key={attachment.id} style={styles.pendingItem}>
              <View style={[styles.pendingFrame, { backgroundColor: theme.colors.background, borderColor: failed ? theme.colors.danger : theme.colors.border }]}>
                {kind === 'image' ? (
                  <Image
                    accessible
                    accessibilityIgnoresInvertColors
                    accessibilityLabel={`${attachment.fileName}, ready to send`}
                    accessibilityRole="image"
                    resizeMode="cover"
                    source={{ uri: attachment.uri }}
                    style={styles.fill}
                  />
                ) : kind === 'video' ? (
                  <>
                    <PendingVideoThumbnail uri={attachment.uri} label={`${attachment.fileName}, ready to send`} />
                    <View style={styles.playBadge}>
                      <AppIcon name="play" size={16} color={OVERLAY_ICON} />
                    </View>
                  </>
                ) : (
                  <View style={styles.placeholder}>
                    <AppIcon name={placeholderIcon(kind)} size={26} color={failed ? theme.colors.danger : theme.colors.textMuted} />
                    <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{kindLabel(kind)}</AppText>
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${attachment.fileName}`}
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  hitSlop={8}
                  onPress={() => onRemove(attachment.id)}
                  style={({ pressed }) => [styles.remove, pressed && styles.pressed, disabled && styles.disabled]}>
                  <AppIcon name="close" size={14} color={OVERLAY_ICON} />
                </Pressable>
              </View>
              <AppText
                variant="caption"
                color={failed ? theme.colors.danger : theme.colors.textMuted}
                numberOfLines={1}
                style={styles.pendingName}>
                {attachment.fileName}
              </AppText>
              {!failed ? (
                <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1} style={styles.pendingName}>
                  {formatFileSize(attachment.fileSize)}
                </AppText>
              ) : null}
            </View>
          )
        })}
      </ScrollView>
      {firstError ? (
        <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger} numberOfLines={2}>
          {firstError.error ?? 'This file could not be prepared.'}
        </AppText>
      ) : null}
    </View>
  )
}

export type SentChatAttachment = {
  storageId: string
  fileName: string
  kind: ChatAttachmentKind
  url?: string
}

export function MessageAttachmentMedia({ attachments, onOpen, tileSize = SENT_TILE_SIZE }: {
  attachments: SentChatAttachment[]
  onOpen: (url: string) => void
  tileSize?: number
}) {
  const theme = useAppTheme()

  return (
    <View style={styles.sentGrid}>
      {attachments.map((attachment) => {
        const canOpen = Boolean(attachment.url)
        return (
          <Pressable
            key={attachment.storageId}
            accessibilityRole="button"
            accessibilityLabel={canOpen ? `Open ${kindNoun(attachment.kind)} ${attachment.fileName}` : `${kindNoun(attachment.kind)} ${attachment.fileName} is unavailable`}
            accessibilityState={{ disabled: !canOpen }}
            disabled={!canOpen}
            onPress={() => {
              if (attachment.url) onOpen(attachment.url)
            }}
            style={({ pressed }) => [
              styles.sentFrame,
              { width: tileSize, height: tileSize, backgroundColor: theme.colors.background, borderColor: canOpen ? theme.colors.border : theme.colors.danger },
              pressed && styles.pressed,
            ]}>
            {attachment.kind === 'image' && attachment.url ? (
              <Image
                accessible={false}
                accessibilityIgnoresInvertColors
                resizeMode="cover"
                source={{ uri: attachment.url }}
                style={styles.fill}
              />
            ) : (
              <View style={styles.placeholder}>
                <AppIcon
                  name={placeholderIcon(attachment.kind)}
                  size={30}
                  color={canOpen ? theme.colors.text : theme.colors.danger}
                />
                <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
                  {canOpen ? kindLabel(attachment.kind) : 'Secure link unavailable'}
                </AppText>
              </View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

function placeholderIcon(kind: ChatAttachmentKind) {
  if (kind === 'video') return 'play-circle-outline' as const
  if (kind === 'image') return 'image-outline' as const
  return 'document-outline' as const
}

function kindLabel(kind: ChatAttachmentKind) {
  if (kind === 'video') return 'Video'
  if (kind === 'image') return 'Photo'
  return 'File'
}

function kindNoun(kind: ChatAttachmentKind) {
  if (kind === 'video') return 'video'
  if (kind === 'image') return 'photo'
  return 'file'
}

const styles = StyleSheet.create({
  tray: {
    gap: density.textSectionGap,
  },
  trayRow: {
    gap: density.cardGap,
    paddingRight: density.cardGap,
  },
  pendingItem: {
    width: PENDING_TILE_SIZE,
    gap: density.textPairGap,
  },
  pendingFrame: {
    width: PENDING_TILE_SIZE,
    height: PENDING_TILE_SIZE,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pendingName: {
    textAlign: 'center',
  },
  sentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: density.textSectionGap,
  },
  sentFrame: {
    maxWidth: '100%',
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: density.textPairGap,
    paddingHorizontal: density.textSectionGap,
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OVERLAY_SCRIM,
  },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 28,
    height: 28,
    marginTop: -14,
    marginLeft: -14,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OVERLAY_SCRIM,
    pointerEvents: 'none',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.52,
  },
})
