import { useQuery } from 'convex/react'
import * as Linking from 'expo-linking'
import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi, type ConversationId } from '@/backend/client'
import { Avatar } from '@/design-system/atoms/Avatar'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { AttachmentMetaRow } from '@/design-system/molecules/AttachmentMetaRow'
import { BottomSheet } from '@/design-system/molecules/BottomSheet'
import { formatFileSize } from '@/data/messageViewModels'
import { MessageAttachmentMedia } from '@/features/messaging/ChatAttachmentPreview'
import { downloadChatAttachment } from '@/features/messaging/downloadChatAttachment'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density, radii } from '@/theme/tokens'

const DETAIL_TILE_SIZE = 84

export function ConversationDetailsSheet({ visible, conversationId, otherName, imageUrl, paused = false, onClose }: {
  visible: boolean
  conversationId: string
  otherName: string
  imageUrl?: string | null
  paused?: boolean
  onClose: () => void
}) {
  const theme = useAppTheme()
  const assets = useQuery(mobileApi.conversations.assets, visible ? { conversationId: conversationId as ConversationId } : 'skip')
  const [openError, setOpenError] = useState('')

  const media = assets?.media ?? []
  const visualMedia = media.filter((item) => item.kind === 'image' || item.kind === 'video')
  const files = media.filter((item) => item.kind === 'file')
  const links = assets?.links ?? []

  async function openLink(url: string) {
    setOpenError('')
    try {
      await Linking.openURL(url)
    } catch {
      setOpenError('This link could not be opened. Please try again.')
    }
  }

  async function downloadFile(url: string, fileName: string) {
    setOpenError('')
    try {
      await downloadChatAttachment(url, fileName)
    } catch {
      setOpenError('This file could not be downloaded. Please try again.')
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="Conversation details"
      description={`Conversation with ${otherName}`}
      closeLabel="Close conversation details"
      onClose={onClose}>
      <View style={styles.content}>
        <View style={styles.identity}>
          <Avatar uri={imageUrl ?? undefined} name={otherName} size={52} />
          <View style={styles.identityCopy}>
            <AppText variant="bodyStrong" numberOfLines={1}>{otherName}</AppText>
            <AppText variant="caption" color={paused ? theme.colors.danger : theme.colors.textMuted}>
              {paused ? 'Conversation paused' : 'Direct conversation'}
            </AppText>
          </View>
        </View>

        <Section title="Photos and videos" count={visualMedia.length}>
          {assets === undefined ? (
            <AppText variant="caption" color={theme.colors.textMuted}>Loading shared media.</AppText>
          ) : visualMedia.length ? (
            <MessageAttachmentMedia
              attachments={visualMedia.map((item) => ({
                storageId: String(item.storageId),
                fileName: item.fileName,
                kind: item.kind,
                url: item.url ?? undefined,
              }))}
              onOpen={(url) => void openLink(url)}
              tileSize={DETAIL_TILE_SIZE}
            />
          ) : (
            <AppText variant="caption" color={theme.colors.textMuted}>No photos or videos shared yet.</AppText>
          )}
        </Section>

        <Section title="Files" count={files.length}>
          {assets === undefined ? null : files.length ? files.map((item) => (
            <AttachmentMetaRow
              key={`${item.storageId}-${item.fileName}`}
              name={item.fileName}
              detail={`${formatFileSize(item.size)} · ${item.url ? 'Download file' : 'Secure link unavailable'}`}
              state={item.url ? 'default' : 'danger'}
              actionRole="link"
              actionLabel={`Download attachment ${item.fileName}`}
              onAction={item.url ? () => downloadFile(item.url as string, item.fileName) : undefined}
            />
          )) : (
            <AppText variant="caption" color={theme.colors.textMuted}>No files shared yet.</AppText>
          )}
        </Section>

        <Section title="Links" count={links.length}>
          {assets === undefined ? null : links.length ? links.map((item) => (
            <Pressable
              key={item.url}
              accessibilityRole="link"
              accessibilityLabel={`Open link ${item.url}`}
              onPress={() => void openLink(item.url)}
              style={({ pressed }) => [styles.linkRow, { borderColor: theme.colors.border }, pressed && styles.pressed]}>
              <View style={[styles.linkIcon, { backgroundColor: theme.colors.surface }]}>
                <AppIcon name="link-outline" size={18} color={theme.colors.textMuted} />
              </View>
              <AppText variant="caption" numberOfLines={1} ellipsizeMode="middle" style={styles.linkText}>{item.url}</AppText>
            </Pressable>
          )) : (
            <AppText variant="caption" color={theme.colors.textMuted}>No links shared yet.</AppText>
          )}
        </Section>

        {openError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{openError}</AppText> : null}
      </View>
    </BottomSheet>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const theme = useAppTheme()

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{count}</AppText>
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { gap: density.sectionGap, paddingBottom: density.contentGap },
  identity: { flexDirection: 'row', alignItems: 'center', gap: density.cardGap },
  identityCopy: { flex: 1, minWidth: 0, gap: density.textPairGap },
  section: { gap: density.cardGap },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: density.cardGap },
  linkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: density.cardGap, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: density.textSectionGap },
  linkIcon: { width: 32, height: 32, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  linkText: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.62 },
})
