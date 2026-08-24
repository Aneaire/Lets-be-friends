import * as ImagePicker from 'expo-image-picker'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { mobileApi, type BookingId } from '@/backend/client'
import { evidenceAssetToArrayBuffer } from '@/data/evidence'

import { BookingEvidencePresentation } from './BookingEvidencePresentation'

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
  const canReadEvidence = status === 'accepted' && pricingModel === 'member_wallet_v2'
  const evidence = useQuery(mobileApi.bookingEvidence.status, canReadEvidence ? { bookingId } : 'skip')
  const uploadImage = useAction(mobileApi.bookingEvidence.uploadImage)
  const skipEvidence = useMutation(mobileApi.bookingEvidence.skip)
  const [busy, setBusy] = useState<'upload' | 'skip' | null>(null)
  const [message, setMessage] = useState('')
  const [skipError, setSkipError] = useState('')
  const [skipConfirmationVisible, setSkipConfirmationVisible] = useState(false)
  const busyRef = useRef(false)
  const decision = evidence?.decision

  useEffect(() => {
    onDecisionChange?.(Boolean(decision))
  }, [decision, onDecisionChange])

  if (!canReadEvidence) return null

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
    setSkipError('')
    try {
      await skipEvidence({ bookingId, warningAcknowledged: true })
      setSkipConfirmationVisible(false)
      setMessage('Evidence was skipped after you acknowledged the warning.')
    } catch {
      setSkipError('The evidence decision could not be saved. Please try again.')
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }

  function requestSkip() {
    if (busyRef.current || decision) return
    setSkipError('')
    setSkipConfirmationVisible(true)
  }

  function closeSkipConfirmation() {
    if (busyRef.current) return
    setSkipConfirmationVisible(false)
    setSkipError('')
  }

  return (
    <BookingEvidencePresentation
      participantRole={evidence?.role ?? participantRole}
      decision={decision}
      loading={evidence === undefined}
      busy={busy}
      participantCompletedAt={participantCompletedAt}
      otherParticipantCompletedAt={otherParticipantCompletedAt}
      message={message}
      skipError={skipError}
      skipConfirmationVisible={skipConfirmationVisible}
      onChooseImage={() => void chooseAndUpload()}
      onRequestSkip={requestSkip}
      onCloseSkipConfirmation={closeSkipConfirmation}
      onConfirmSkip={skip}
    />
  )
}
