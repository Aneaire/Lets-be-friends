import { useState } from 'react'
import { useUser } from '@clerk/expo'
import { useMutation, useQuery } from 'convex/react'

import { mobileApi } from '@/backend/client'

import { AccountDeletionSettingsPresentation } from './AccountDeletionSettingsPresentation'
import { ACCOUNT_DELETION_CONFIRMATION } from './accountDeletionModel'

export function AccountDeletionSettings({
  onDeleted,
}: {
  onDeleted: (result: { identityDeleted: boolean }) => Promise<void> | void
}) {
  const summary = useQuery(mobileApi.accountDeletion.deletionSummary, {})
  const deleteAccount = useMutation(mobileApi.accountDeletion.deleteAccount)
  const { user } = useUser()
  const [confirming, setConfirming] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    if (busy) return
    setConfirming(false)
    setConfirmation('')
    setError(null)
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await deleteAccount({ confirmation: ACCOUNT_DELETION_CONFIRMATION })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete your account. Try again.')
      setBusy(false)
      return
    }
    // The Convex records are already erased. Removing the sign-in identity must
    // not stop the member from leaving if Clerk asks for a fresh session.
    let identityDeleted = false
    try {
      await user?.delete()
      identityDeleted = Boolean(user)
    } catch {
      identityDeleted = false
    }
    setBusy(false)
    setConfirming(false)
    // Clerk ends the session when it deletes the identity. Calling signOut on
    // that dead session is what crashed the app on Android, so the caller only
    // signs out when the identity is still alive.
    await onDeleted({ identityDeleted })
  }

  return (
    <AccountDeletionSettingsPresentation
      state={{
        summary: summary ?? null,
        confirming,
        confirmation,
        busy,
        error,
      }}
      onChangeConfirmation={setConfirmation}
      onStart={() => setConfirming(true)}
      onCancel={close}
      onConfirm={() => void confirm()}
    />
  )
}
