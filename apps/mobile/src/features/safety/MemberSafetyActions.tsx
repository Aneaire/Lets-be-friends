import { useMutation, useQuery } from 'convex/react'
import { useRef, useState } from 'react'

import { mobileApi, type UserId } from '@/backend/client'
import { ConfirmationDialog } from '@/design-system/molecules/ConfirmationDialog'
import { safeProductError } from '@/data/productErrors'

import {
  MemberSafetyActionsPresentation,
  memberBlockConfirmationCopy,
} from './MemberSafetyActionsPresentation'

export function MemberSafetyActions({
  userId,
  displayName,
}: {
  userId: string
  displayName: string
}) {
  const relationship = useQuery(mobileApi.safety.relationship, {
    userId: userId as UserId,
  })
  const setBlocked = useMutation(mobileApi.safety.setBlocked)
  const setMuted = useMutation(mobileApi.safety.setMuted)
  const [busy, setBusy] = useState<'block' | 'mute' | null>(null)
  const mutationLock = useRef<'block' | 'mute' | null>(null)
  const [message, setMessage] = useState('')
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const blocked = Boolean(relationship?.blocked)
  const confirmation = memberBlockConfirmationCopy(displayName, blocked)

  async function updateBlock(nextBlocked: boolean) {
    if (busy || mutationLock.current) return
    mutationLock.current = 'block'
    setBusy('block')
    setMessage('')
    try {
      await setBlocked({ userId: userId as UserId, blocked: nextBlocked })
      setConfirmationOpen(false)
    } catch (error) {
      setMessage(safeProductError('update_safety', error))
    } finally {
      mutationLock.current = null
      setBusy(null)
    }
  }

  async function updateMute(muted: boolean) {
    if (busy || mutationLock.current) return
    mutationLock.current = 'mute'
    setBusy('mute')
    setMessage('')
    try {
      await setMuted({ userId: userId as UserId, muted })
    } catch (error) {
      setMessage(safeProductError('update_safety', error))
    } finally {
      mutationLock.current = null
      setBusy(null)
    }
  }

  function closeConfirmation() {
    if (mutationLock.current) return
    setConfirmationOpen(false)
  }

  return (
    <>
      <MemberSafetyActionsPresentation
        relationship={relationship}
        busy={busy}
        message={message}
        onToggleMute={() => void updateMute(!relationship?.muted)}
        onChangeBlock={() => {
          setMessage('')
          setConfirmationOpen(true)
        }}
      />
      <ConfirmationDialog
        visible={confirmationOpen}
        onClose={closeConfirmation}
        onConfirm={() => updateBlock(!blocked)}
        title={confirmation.title}
        description={confirmation.description}
        confirmLabel={confirmation.confirmLabel}
        busyLabel={blocked ? 'Unblocking member' : 'Blocking member'}
        cancelLabel="Keep current safety setting"
        intent={confirmation.intent}
        busy={busy === 'block'}
      />
    </>
  )
}
