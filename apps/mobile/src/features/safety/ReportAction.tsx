import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { BottomSheet } from '@/design-system/molecules/BottomSheet'
import { FormField } from '@/design-system/molecules/FormField'
import { density } from '@/theme/tokens'

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

  function close() {
    if (busyRef.current) return
    setOpen(false)
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
      <BottomSheet
        visible={open}
        onClose={close}
        closeLabel="Close report"
        title="Send a safety report"
        description="Reports are private. Include only the details needed for review."
        busy={busy}
        footer={(
          <View style={styles.actions}>
            <ActionButton label="Send report" onPress={() => void submit()} intent="danger" loading={busy} />
            <ActionButton label="Cancel" onPress={close} intent="neutral" secondary disabled={busy} />
          </View>
        )}>
        <View style={styles.form}>
          <FormField
            label="Report details"
            error={reason.length > 2_000 ? 'Report details can be up to 2,000 characters.' : undefined}
            hint={`${reason.length}/2,000 characters`}>
            <TextField
              value={reason}
              onChangeText={(value) => { setReason(value); setMessage('') }}
              placeholder="What happened?"
              multiline
              maxLength={2_001}
              editable={!busy}
              style={styles.input}
            />
          </FormField>
          {message ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{message}</AppText> : null}
        </View>
      </BottomSheet>
    </>
  )
}

const styles = StyleSheet.create({
  compact: { minHeight: density.controlHeight, justifyContent: 'center', paddingHorizontal: density.textStackGap },
  form: { gap: density.cardGap },
  actions: { gap: density.cardGap },
  input: { minHeight: 128 },
})
