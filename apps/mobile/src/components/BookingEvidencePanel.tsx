import { useMutation, useQuery } from 'convex/react'
import { useRef, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { mobileApi, type BookingId } from '@/backend/client'
import { evidenceDecisionCopy } from '@/data/evidence'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from './ActionButton'
import { AppText } from './Typography'

export function BookingEvidencePanel({
  bookingId,
  status,
  pricingModel,
  participantCompletedAt,
  otherParticipantCompletedAt,
  participantRole,
}: {
  bookingId: BookingId
  status: string
  pricingModel?: string
  participantCompletedAt?: number
  otherParticipantCompletedAt?: number
  participantRole: 'member_end' | 'host_start'
}) {
  const theme = useAppTheme()
  const canReadEvidence = status === 'accepted' && pricingModel === 'member_wallet_v2'
  const evidence = useQuery(mobileApi.bookingEvidence.status, canReadEvidence ? { bookingId } : 'skip')
  const skipEvidence = useMutation(mobileApi.bookingEvidence.skip)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const busyRef = useRef(false)

  if (!canReadEvidence) return null

  const decision = evidence?.decision
  const copy = evidenceDecisionCopy(evidence?.role ?? participantRole, decision)

  async function skip() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      await skipEvidence({ bookingId, warningAcknowledged: true })
      setMessage('Evidence was skipped after you acknowledged the warning.')
    } catch {
      setMessage('The evidence decision could not be saved. Please try again.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function confirmSkip() {
    Alert.alert(
      'Strict warning: skip private evidence?',
      'Skipping means no private evidence image will be available to help an authorized reviewer evaluate a later booking report. This decision cannot be replaced in the mobile app.',
      [
        { text: 'Keep evidence option', style: 'cancel' },
        { text: 'Skip evidence', style: 'destructive', onPress: () => void skip() },
      ],
    )
  }

  return (
    <View style={[styles.panel, { backgroundColor: theme.colors.socialSoft, borderColor: theme.colors.social }]}>
      <View style={styles.copy}>
        <AppText variant="heading">{copy.label}</AppText>
        {evidence === undefined
          ? <AppText variant="caption" color={theme.colors.textMuted}>Loading the live evidence decision.</AppText>
          : <AppText variant="caption" color={theme.colors.textMuted}>{copy.detail}</AppText>}
      </View>

      {evidence !== undefined && !decision ? (
        <>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Private image upload remains available in the web app. This mobile screen does not open a selected booking in the browser because the browser account and booking cannot yet be bound safely.
          </AppText>
          <ActionButton
            label={busy ? 'Saving decision' : 'Skip evidence after warning'}
            onPress={confirmSkip}
            disabled={busy}
            secondary
          />
        </>
      ) : null}

      {evidence !== undefined && decision && !participantCompletedAt ? (
        <AppText variant="caption" color={theme.colors.textMuted}>
          Mobile completion is unavailable until the server can enforce the scheduled session end with authoritative time.
        </AppText>
      ) : null}

      {participantCompletedAt ? (
        <AppText variant="caption" color={theme.colors.textMuted}>
          You confirmed completion{otherParticipantCompletedAt ? ', and the other person also confirmed.' : '. Waiting for the other person to confirm.'}
        </AppText>
      ) : null}
      {message ? <AppText accessibilityLiveRegion="polite" variant="caption" color={theme.colors.text}>{message}</AppText> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  copy: { gap: 4 },
})
