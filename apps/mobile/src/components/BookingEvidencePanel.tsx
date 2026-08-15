import * as ImagePicker from 'expo-image-picker'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { Alert, Platform, StyleSheet, View } from 'react-native'

import { mobileApi, type BookingId } from '@/backend/client'
import { evidenceAssetToArrayBuffer, evidenceDecisionCopy } from '@/data/evidence'
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
  onDecisionChange,
}: {
  bookingId: BookingId
  status: string
  pricingModel?: string
  participantCompletedAt?: number
  otherParticipantCompletedAt?: number
  participantRole: 'member_end' | 'companion_start'
  onDecisionChange?: (ready: boolean) => void
}) {
  const theme = useAppTheme()
  const canReadEvidence = status === 'accepted' && pricingModel === 'member_wallet_v2'
  const evidence = useQuery(mobileApi.bookingEvidence.status, canReadEvidence ? { bookingId } : 'skip')
  const uploadImage = useAction(mobileApi.bookingEvidence.uploadImage)
  const skipEvidence = useMutation(mobileApi.bookingEvidence.skip)
  const [busy, setBusy] = useState<'upload' | 'skip' | null>(null)
  const [message, setMessage] = useState('')
  const busyRef = useRef(false)
  const decision = evidence?.decision

  useEffect(() => {
    onDecisionChange?.(Boolean(decision))
  }, [decision, onDecisionChange])

  if (!canReadEvidence) return null

  const copy = evidenceDecisionCopy(evidence?.role ?? participantRole, decision)

  async function chooseAndUpload() {
    if (busyRef.current || decision) return
    setMessage('')
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false)
        if (!permission.granted) {
          setMessage('Photo access is needed only to select an existing private evidence image. You can continue without uploading and review the skip warning instead.')
          return
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
      })
      if (result.canceled || !result.assets[0]) return

      busyRef.current = true
      setBusy('upload')
      const converted = await evidenceAssetToArrayBuffer(result.assets[0])
      if (!converted.ok) {
        setMessage(converted.message)
        return
      }
      await uploadImage({ bookingId, bytes: converted.bytes, contentType: converted.contentType })
      setMessage('Private evidence uploaded. Only authorized reviewers can access it for an active booking report, and access is audited.')
    } catch {
      setMessage('The private evidence image could not be uploaded. Choose a supported image and try again.')
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }

  async function skip() {
    if (busyRef.current || decision) return
    busyRef.current = true
    setBusy('skip')
    setMessage('')
    try {
      await skipEvidence({ bookingId, warningAcknowledged: true })
      setMessage('Evidence was skipped after you acknowledged the warning.')
    } catch {
      setMessage('The evidence decision could not be saved. Please try again.')
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }

  function confirmSkip() {
    Alert.alert(
      'Strict warning: skip private evidence?',
      'Skipping means no private evidence image will be available to help an authorized reviewer evaluate a later booking report. This one-time decision cannot be replaced in the mobile app.',
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
            This optional image is private. It is retained for a limited period and can be opened only by an authorized reviewer during an active booking report. Access is audited. The other participant cannot view it.
          </AppText>
          <ActionButton
            label={busy === 'upload' ? 'Uploading private image' : 'Choose private evidence image'}
            onPress={() => void chooseAndUpload()}
            disabled={busy !== null}
          />
          <ActionButton
            label={busy === 'skip' ? 'Saving decision' : 'Skip evidence after warning'}
            onPress={confirmSkip}
            disabled={busy !== null}
            secondary
          />
        </>
      ) : null}

      {evidence !== undefined && decision && !participantCompletedAt ? (
        <AppText variant="caption" color={theme.colors.textMuted}>
          Your evidence choice is recorded. You can now confirm completion after the experience ends.
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
