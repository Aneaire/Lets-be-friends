import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native'

import { mobileApi, type BookingId } from '@/backend/client'
import { validateCancellationReason } from '@/data/bookingLifecycle'
import { safeProductError } from '@/data/productErrors'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from './ActionButton'
import { AppText } from './Typography'

export function BookingCancelAction({ bookingId, participantLabel }: {
  bookingId: BookingId
  participantLabel: 'member' | 'Companion'
}) {
  const theme = useAppTheme()
  const cancelBooking = useMutation(mobileApi.bookings.cancel)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const busyRef = useRef(false)

  function close() {
    if (busyRef.current) return
    setOpen(false)
    setMessage('')
  }

  async function cancel() {
    if (busyRef.current) return
    const validation = validateCancellationReason(reason)
    if (!validation.ok) {
      setMessage(validation.message)
      return
    }

    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      await cancelBooking({ bookingId, reason: validation.reason })
      setOpen(false)
      setReason('')
    } catch (error) {
      setMessage(safeProductError('cancel_booking', error))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel booking"
        accessibilityHint={`Cancels this booking as the ${participantLabel}`}
        onPress={() => { setMessage(''); setOpen(true) }}
        style={({ pressed }) => [styles.button, { borderColor: theme.colors.danger }, pressed && styles.pressed]}>
        <AppText variant="bodyStrong" color={theme.colors.danger}>Cancel booking</AppText>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}>
          <View style={[styles.modal, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <View style={styles.header}>
              <View style={styles.copy}>
                <AppText variant="heading">Cancel this booking?</AppText>
                <AppText variant="caption" color={theme.colors.textMuted}>Cancellation cannot be undone. Current cancellation and wallet rules will apply.</AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close cancellation form" disabled={busy} onPress={close} style={styles.close}>
                <AppText variant="heading">×</AppText>
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel="Cancellation reason, optional"
              value={reason}
              onChangeText={(value) => { setReason(value); setMessage('') }}
              placeholder="Optional reason for the other participant"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              maxLength={1_001}
              editable={!busy}
              style={[styles.input, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surfaceRaised, borderColor: reason.length > 1_000 ? theme.colors.danger : theme.colors.border }]}
            />
            <AppText variant="caption" color={reason.length > 1_000 ? theme.colors.danger : theme.colors.textMuted}>{reason.length}/1,000</AppText>
            {message ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{message}</AppText> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={busy ? 'Cancelling booking' : 'Confirm cancellation'}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void cancel()}
              style={({ pressed }) => [styles.dangerButton, { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger }, busy && styles.disabled, pressed && styles.pressed]}>
              <AppText variant="bodyStrong" color={theme.colors.inverseText}>{busy ? 'Cancelling booking' : 'Confirm cancellation'}</AppText>
            </Pressable>
            <ActionButton label="Keep booking" onPress={close} disabled={busy} secondary />
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, padding: 20, justifyContent: 'center' },
  modal: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 12, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  copy: { flex: 1, gap: 4 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 120, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingTop: 13, textAlignVertical: 'top' },
  dangerButton: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.76 },
})
