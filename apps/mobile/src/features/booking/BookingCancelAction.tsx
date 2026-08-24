import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { mobileApi, type BookingId } from '@/backend/client'
import { validateCancellationReason } from '@/data/bookingLifecycle'
import { safeProductError } from '@/data/productErrors'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { ConfirmationDialog } from '@/design-system/molecules/ConfirmationDialog'
import { FormField } from '@/design-system/molecules/FormField'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

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

  const reasonError = reason.length > 1_000 ? 'Cancellation reasons can be up to 1,000 characters.' : undefined

  return (
    <>
      <ActionButton
        label="Cancel booking"
        accessibilityHint={`Cancels this booking as the ${participantLabel}`}
        intent="danger"
        secondary
        onPress={() => { setMessage(''); setOpen(true) }}
      />
      <ConfirmationDialog
        visible={open}
        onClose={close}
        onConfirm={cancel}
        title="Cancel this booking?"
        description="Cancellation cannot be undone. Current cancellation and wallet rules will apply."
        confirmLabel="Confirm cancellation"
        busyLabel="Cancelling booking"
        cancelLabel="Keep booking"
        intent="danger"
        busy={busy}>
        <View style={styles.form}>
          <FormField
            label="Cancellation reason"
            optional
            error={reasonError}
            hint={`${reason.length}/1,000 characters`}>
            <TextField
              value={reason}
              onChangeText={(value) => { setReason(value); setMessage('') }}
              placeholder="Reason for the other participant"
              multiline
              maxLength={1_001}
              editable={!busy}
              style={styles.input}
            />
          </FormField>
          {message ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{message}</AppText> : null}
        </View>
      </ConfirmationDialog>
    </>
  )
}

const styles = StyleSheet.create({
  form: { gap: density.cardGap },
  input: { minHeight: 120 },
})
