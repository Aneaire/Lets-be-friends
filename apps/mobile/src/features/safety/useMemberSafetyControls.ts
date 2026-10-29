import { useMutation, useQuery } from 'convex/react'
import { useRef, useState } from 'react'

import { mobileApi, type UserId } from '@/backend/client'
import { safeProductError } from '@/data/productErrors'

import { memberBlockConfirmationCopy } from './MemberSafetyActionsPresentation'

/**
 * Shared mute and block controls for a member connection. Screens either render
 * the inline `MemberSafetyActions` presentation or surface the same controls
 * from a compact menu, so the state and mutation handling live here.
 */
export function useMemberSafetyControls({ userId, displayName, onNotice }: {
  userId: string
  displayName: string
  onNotice?: (message: string) => void
}) {
  const relationship = useQuery(mobileApi.safety.relationship, {
    userId: userId as UserId,
  })
  const setBlocked = useMutation(mobileApi.safety.setBlocked)
  const setMuted = useMutation(mobileApi.safety.setMuted)
  const [busy, setBusy] = useState<'block' | 'mute' | null>(null)
  const mutationLock = useRef<'block' | 'mute' | null>(null)
  const [message, setMessageState] = useState('')
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const blocked = Boolean(relationship?.blocked)
  const muted = Boolean(relationship?.muted)
  const confirmation = memberBlockConfirmationCopy(displayName, blocked)

  function setMessage(next: string) {
    setMessageState(next)
    if (next) onNotice?.(next)
  }

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

  return {
    relationship,
    blocked,
    muted,
    busy,
    message,
    confirmation,
    confirmationOpen,
    toggleMute: () => void updateMute(!relationship?.muted),
    requestBlockChange: () => {
      setMessage('')
      setConfirmationOpen(true)
    },
    closeConfirmation,
    confirmBlockChange: () => updateBlock(!blocked),
  }
}
