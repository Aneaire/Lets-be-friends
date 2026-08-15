import type { BookingStatus } from '@lets-be-friends/shared'
import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { mobileApi, type BookingId } from '@/backend/client'
import { bookingCompletionCopy } from '@/data/bookingCompletion'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from './ActionButton'
import { AppText } from './Typography'

export function BookingCompletionAction({ bookingId, status, pricingModel, requestedAt, durationMinutes, viewerRole, participantCompletedAt, otherParticipantCompletedAt, evidenceReady }: {
  bookingId: BookingId
  status: BookingStatus
  pricingModel?: string
  requestedAt: number
  durationMinutes: number
  viewerRole: 'member' | 'companion'
  participantCompletedAt?: number
  otherParticipantCompletedAt?: number
  evidenceReady: boolean
}) {
  const theme = useAppTheme()
  const markCompleted = useMutation(mobileApi.bookings.markCompleted)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const busyRef = useRef(false)
  const copy = bookingCompletionCopy({ status, pricingModel, requestedAt, durationMinutes, viewerRole, participantCompletedAt, otherParticipantCompletedAt, evidenceReady })

  async function complete() {
    if (busyRef.current || !copy.actionable) return
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      const result = await markCompleted({ bookingId })
      setMessage(result.awaitingOtherConfirmation
        ? 'Your completion confirmation was recorded. Waiting for the other person.'
        : 'Completion was confirmed by both people. The review window is now available.')
    } catch {
      setMessage('Completion could not be confirmed. Check the current booking and evidence state, then try again.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function confirm() {
    Alert.alert(
      'Confirm this experience is complete?',
      'Confirm only after the scheduled experience has ended. This participant confirmation cannot be withdrawn in the mobile app.',
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Confirm completed', onPress: () => void complete() },
      ],
    )
  }

  return (
    <View style={[styles.panel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <View style={styles.copy}>
        <AppText variant="bodyStrong">{copy.label}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{copy.detail}</AppText>
      </View>
      {copy.actionable ? <ActionButton label={busy ? 'Confirming completion' : 'Confirm completed'} onPress={confirm} disabled={busy} /> : null}
      {message ? <AppText accessibilityLiveRegion="polite" variant="caption" color={theme.colors.text}>{message}</AppText> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  copy: { gap: 4 },
})
