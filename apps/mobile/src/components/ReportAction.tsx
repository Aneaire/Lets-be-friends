import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from './ActionButton'
import { AppText } from './Typography'

type ReportTarget = 'profile' | 'message' | 'review' | 'post' | 'comment' | 'user'

export function ReportAction({ targetType, targetId, label, compact = false, open: controlledOpen, onOpenChange, showTrigger = true, onReported }: {
  targetType: ReportTarget
  targetId: string
  label: string
  compact?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
  onReported?: () => void
}) {
  const theme = useAppTheme()
  const createReport = useMutation(mobileApi.reports.create)
  const [internalOpen, setInternalOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [reported, setReported] = useState(false)
  const busyRef = useRef(false)
  const open = controlledOpen ?? internalOpen

  function setOpen(next: boolean) {
    if (controlledOpen === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }

  async function submit() {
    const trimmed = reason.trim()
    if (busyRef.current || reported) return
    if (!trimmed) {
      setMessage('Explain what needs a safety review.')
      return
    }
    if (trimmed.length > 2_000) {
      setMessage('Report details can be up to 2,000 characters.')
      return
    }
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      await createReport({ targetType, targetId, reason: trimmed })
      setReported(true)
      setOpen(false)
      setReason('')
      onReported?.()
    } catch {
      setMessage('This report could not be sent. Please try again.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <>
      {showTrigger && compact ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reported ? 'Report sent' : label}
          disabled={reported}
          onPress={() => { setMessage(''); setOpen(true) }}
          style={styles.compact}>
          <AppText variant="caption" color={theme.colors.danger}>{reported ? 'Report sent' : label}</AppText>
        </Pressable>
      ) : showTrigger ? (
        <ActionButton label={reported ? 'Report sent' : label} onPress={() => { setMessage(''); setOpen(true) }} intent="danger" secondary disabled={reported} />
      ) : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => !busy && setOpen(false)}>
        <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}>
          <View style={[styles.sheet, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <View style={styles.header}>
              <View style={styles.copy}>
                <AppText variant="heading">Send a safety report</AppText>
                <AppText variant="caption" color={theme.colors.textMuted}>Reports are private. Include only the details needed for review.</AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close report" disabled={busy} onPress={() => setOpen(false)} style={styles.close}><AppText variant="heading">×</AppText></Pressable>
            </View>
            <TextInput
              accessibilityLabel="Report details"
              value={reason}
              onChangeText={(value) => { setReason(value); setMessage('') }}
              placeholder="What happened?"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              maxLength={2_001}
              editable={!busy}
              style={[styles.input, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surfaceRaised, borderColor: reason.length > 2_000 ? theme.colors.danger : theme.colors.border }]}
            />
            <AppText variant="caption" color={reason.length > 2_000 ? theme.colors.danger : theme.colors.textMuted}>{reason.length}/2,000</AppText>
            {message ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{message}</AppText> : null}
            <ActionButton label={busy ? 'Sending report' : 'Send report'} onPress={() => void submit()} intent="danger" disabled={busy} />
            <ActionButton label="Cancel" onPress={() => setOpen(false)} intent="danger" secondary disabled={busy} />
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  compact: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderWidth: 1, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  copy: { flex: 1, gap: 3 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 128, borderWidth: 1, borderRadius: 12, padding: 13, textAlignVertical: 'top' },
})
