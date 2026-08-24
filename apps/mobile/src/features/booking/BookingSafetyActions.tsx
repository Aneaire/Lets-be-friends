import type { BookingStatus } from '@lets-be-friends/shared'
import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi, type BookingId } from '@/backend/client'
import {
  canSubmitBookingReview,
  validateReportReason,
  validateReviewInput,
} from '@/data/bookingActions'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { Dialog } from '@/design-system/molecules/Dialog'
import { FormField } from '@/design-system/molecules/FormField'
import { density } from '@/theme/tokens'

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
      <Dialog
        visible={form !== null}
        onClose={close}
        closeLabel="Close form"
        title={form === 'report' ? 'Report this booking' : 'Review this booking'}
        description={form === 'report'
          ? 'Describe what happened. This goes to the safety review team and may place a hold on booking funds.'
          : 'Choose a rating from 1 to 5. Written feedback is optional.'}
        busy={busy}
        footer={(
          <View style={styles.actions}>
            <ActionButton
              label={form === 'report' ? 'Send report' : 'Submit review'}
              onPress={() => { void (form === 'report' ? report() : review()) }}
              intent={form === 'report' ? 'danger' : 'social'}
              loading={busy}
            />
            <ActionButton label="Cancel" onPress={close} intent="neutral" disabled={busy} secondary />
          </View>
        )}>
        <View style={styles.form}>
          {form === 'report' ? (
            <FormField
              label="Report details"
              error={reason.length > 2_000 ? 'Report details can be up to 2,000 characters.' : undefined}
              hint={`${reason.length}/2,000 characters`}>
              <TextField
                value={reason}
                onChangeText={(value) => { setReason(value); setMessage('') }}
                placeholder="Explain why this booking needs a safety review"
                multiline
                maxLength={2_001}
                editable={!busy}
                style={styles.multiline}
              />
            </FormField>
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
                    style={({ pressed }) => [
                      styles.rating,
                      {
                        borderColor: rating === value ? theme.colors.socialControl : theme.colors.border,
                        backgroundColor: rating === value ? theme.colors.socialSoft : theme.colors.surfaceRaised,
                      },
                      busy && styles.disabled,
                      pressed && styles.pressed,
                    ]}>
                    <AppText variant="bodyStrong" color={rating === value ? theme.colors.socialText : theme.colors.text}>{value} ★</AppText>
                  </Pressable>
                ))}
              </View>
              <FormField
                label="Review"
                optional
                error={reviewBody.length > 2_000 ? 'Reviews can be up to 2,000 characters.' : undefined}
                hint={`${reviewBody.length}/2,000 characters`}>
                <TextField
                  value={reviewBody}
                  onChangeText={(value) => { setReviewBody(value); setMessage('') }}
                  placeholder="Share optional feedback"
                  multiline
                  maxLength={2_001}
                  editable={!busy}
                  style={styles.multiline}
                />
              </FormField>
            </>
          )}
          {message && form ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{message}</AppText> : null}
        </View>
      </Dialog>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: density.cardGap },
  copy: { gap: density.textStackGap },
  form: { gap: density.cardGap },
  actions: { gap: density.cardGap },
  multiline: { minHeight: 120 },
  ratings: { flexDirection: 'row', flexWrap: 'wrap', gap: density.cardGap },
  rating: {
    minWidth: 54,
    minHeight: density.controlHeight,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.76 },
})
