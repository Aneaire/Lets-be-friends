import type { BookingStatus } from '@lets-be-friends/shared'
import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native'

import { mobileApi, type BookingId } from '@/backend/client'
import {
  canSubmitBookingReview,
  validateReportReason,
  validateReviewInput,
} from '@/data/bookingActions'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from './ActionButton'
import { AppText } from './Typography'

export function BookingSafetyActions({ bookingId, status, viewerHasReviewed }: {
  bookingId: BookingId
  status: BookingStatus
  viewerHasReviewed: boolean
}) {
  const theme = useAppTheme()
  const createReport = useMutation(mobileApi.reports.create)
  const submitReview = useMutation(mobileApi.reviews.submit)
  const [form, setForm] = useState<'report' | 'review' | null>(null)
  const [reason, setReason] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [reviewBody, setReviewBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const busyRef = useRef(false)
  const canReview = canSubmitBookingReview(status, viewerHasReviewed || reviewSubmitted)

  function open(nextForm: 'report' | 'review') {
    if (busyRef.current || (nextForm === 'report' && reportSubmitted)) return
    setMessage('')
    setForm(nextForm)
  }

  function close() {
    if (busyRef.current) return
    setForm(null)
  }

  async function report() {
    if (busyRef.current || reportSubmitted) return
    const validation = validateReportReason(reason)
    if (!validation.ok) {
      setMessage(validation.message)
      return
    }
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      await createReport({ targetType: 'booking', targetId: String(bookingId), reason: validation.reason })
      setReportSubmitted(true)
      setReason('')
      setForm(null)
      setMessage('Report sent for safety review. Booking funds may be held while it is reviewed.')
    } catch {
      setMessage('This report could not be sent. Please review the details and try again.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function review() {
    if (busyRef.current) return
    const validation = validateReviewInput(rating ?? 0, reviewBody)
    if (!validation.ok) {
      setMessage(validation.message)
      return
    }
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      await submitReview({ bookingId, rating: validation.rating, body: validation.body })
      setReviewSubmitted(true)
      setForm(null)
      setMessage('Review submitted. Thank you for sharing your experience.')
    } catch {
      setMessage('This review could not be submitted. Refresh the booking and try again.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.copy}>
        <AppText variant="heading">Safety and feedback</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>Reports are private safety submissions. Reviews are shared only when the booking review window is open.</AppText>
      </View>
      {canReview ? <ActionButton label="Write a review" onPress={() => open('review')} secondary /> : null}
      {reportSubmitted
        ? <ActionButton label="Report sent" onPress={() => undefined} disabled secondary />
        : <ActionButton label="Report this booking" onPress={() => open('report')} secondary />}
      {message ? <AppText accessibilityLiveRegion="polite" variant="caption" color={theme.colors.textMuted}>{message}</AppText> : null}
      <Modal visible={form !== null} transparent animationType="fade" onRequestClose={close}>
        <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}>
          <View style={[styles.modal, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitle}>
                <AppText variant="heading">{form === 'report' ? 'Report this booking' : 'Review this booking'}</AppText>
                <AppText variant="caption" color={theme.colors.textMuted}>
                  {form === 'report'
                    ? 'Describe what happened. This goes to the safety review team and may place a hold on booking funds.'
                    : 'Choose a rating from 1 to 5. Written feedback is optional.'}
                </AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close form" disabled={busy} onPress={close} style={styles.close}>
                <AppText variant="heading">×</AppText>
              </Pressable>
            </View>
            {form === 'report' ? (
              <>
                <TextInput
                  accessibilityLabel="Booking report reason"
                  value={reason}
                  onChangeText={(value) => { setReason(value); setMessage('') }}
                  placeholder="Explain why this booking needs a safety review"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  maxLength={2_001}
                  editable={!busy}
                  style={[styles.input, styles.multiline, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surfaceRaised, borderColor: reason.length > 2_000 ? theme.colors.danger : theme.colors.border }]}
                />
                <AppText variant="caption" color={reason.length > 2_000 ? theme.colors.danger : theme.colors.textMuted}>{reason.length}/2,000</AppText>
                <ActionButton label={busy ? 'Sending report' : 'Send report'} onPress={() => void report()} disabled={busy} />
              </>
            ) : (
              <>
                <View accessibilityRole="radiogroup" style={styles.ratings}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                      accessibilityState={{ checked: rating === value, disabled: busy }}
                      disabled={busy}
                      onPress={() => { setRating(value); setMessage('') }}
                      style={[styles.rating, { borderColor: rating === value ? theme.colors.social : theme.colors.border, backgroundColor: rating === value ? theme.colors.socialSoft : theme.colors.surfaceRaised }]}>
                      <AppText variant="bodyStrong" color={rating === value ? theme.colors.social : theme.colors.text}>{value} ★</AppText>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel="Review text, optional"
                  value={reviewBody}
                  onChangeText={(value) => { setReviewBody(value); setMessage('') }}
                  placeholder="Share optional feedback"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  maxLength={2_001}
                  editable={!busy}
                  style={[styles.input, styles.multiline, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surfaceRaised, borderColor: reviewBody.length > 2_000 ? theme.colors.danger : theme.colors.border }]}
                />
                <AppText variant="caption" color={reviewBody.length > 2_000 ? theme.colors.danger : theme.colors.textMuted}>{reviewBody.length}/2,000</AppText>
                <ActionButton label={busy ? 'Submitting review' : 'Submit review'} onPress={() => void review()} disabled={busy} />
              </>
            )}
            {message && form ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{message}</AppText> : null}
            <ActionButton label="Cancel" onPress={close} disabled={busy} secondary />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  copy: { gap: 4 },
  scrim: { flex: 1, padding: 20, justifyContent: 'center' },
  modal: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 12, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalTitle: { flex: 1, gap: 4 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  multiline: { minHeight: 120, paddingTop: 13, textAlignVertical: 'top' },
  ratings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rating: { minWidth: 54, minHeight: 44, borderWidth: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
})
