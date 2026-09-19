import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { BottomSheet } from '@/design-system/molecules/BottomSheet'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function ShareSheet({
  visible,
  title,
  previewLabel,
  previewBody,
  onShareToFeed,
  onShareLink,
  onClose,
}: {
  visible: boolean
  title: string
  previewLabel: string
  previewBody?: string
  onShareToFeed: (message: string) => Promise<void>
  onShareLink: () => Promise<void>
  onClose: () => void
}) {
  const theme = useAppTheme()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'share' | 'link' | ''>('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      setNote('')
      setBusy('')
      setError('')
    }
  }, [visible])

  async function shareToFeed() {
    setBusy('share')
    setError('')
    try {
      await onShareToFeed(note.trim())
      setNote('')
      onClose()
    } catch {
      setError('This could not be shared.')
    } finally {
      setBusy('')
    }
  }

  async function shareLink() {
    setBusy('link')
    setError('')
    try {
      await onShareLink()
      onClose()
    } catch {
      setError('The link could not be shared.')
    } finally {
      setBusy('')
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title={title}
      closeLabel="Close share options"
      busy={Boolean(busy)}
      onClose={onClose}
      footer={(
        <View style={styles.actions}>
          <ActionButton label={busy === 'share' ? 'Sharing' : 'Share to feed'} intent="social" disabled={Boolean(busy)} onPress={() => void shareToFeed()} />
          <ActionButton label="Share link" intent="neutral" secondary disabled={Boolean(busy)} onPress={() => void shareLink()} />
        </View>
      )}
    >
      <View style={styles.body}>
        <View style={[styles.preview, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="label" color={theme.colors.textMuted}>{previewLabel}</AppText>
          {previewBody ? <AppText numberOfLines={4}>{previewBody}</AppText> : null}
        </View>
        <TextField
          accessibilityLabel="Add a note to your share"
          value={note}
          onChangeText={(value) => { setNote(value); setError('') }}
          multiline
          maxLength={500}
          placeholder="Why is this worth sharing?"
        />
        {error ? <AppText accessibilityRole="alert" color={theme.colors.danger}>{error}</AppText> : null}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: density.cardGap },
  preview: {
    gap: 4,
    padding: density.compactCardPadding,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  actions: { gap: density.cardGap },
})
