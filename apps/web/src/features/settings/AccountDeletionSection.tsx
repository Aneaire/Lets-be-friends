import { useState } from 'react'
import { useClerk, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { Trash2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { Button } from '../../design-system/atoms/Button'
import { Dialog } from '../../design-system/molecules/Dialog'
import { SettingsSection } from '../presentation/SettingsPresentation'

export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE'

export function canConfirmDeletion(value: string) {
  return value.trim().toUpperCase() === ACCOUNT_DELETION_CONFIRMATION
}

export function AccountDeletionSection() {
  const summary = useQuery(api.accountDeletion.deletionSummary)
  const deleteAccount = useMutation(api.accountDeletion.deleteAccount)
  const { signOut } = useClerk()
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function closeDialog() {
    if (busy) return
    setOpen(false)
    setConfirmation('')
    setError(null)
  }

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      await deleteAccount({ confirmation: ACCOUNT_DELETION_CONFIRMATION })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete your account. Try again.')
      setBusy(false)
      return
    }
    // The Convex records are already erased at this point. Removing the sign-in
    // identity is the last step, and it must not block the member from leaving
    // if Clerk asks for a fresh session.
    try {
      await user?.delete()
    } catch {
      // Signing out still ends the session. Support can remove the identity.
    }
    await signOut({ redirectUrl: '/account-deletion?deleted=1' })
  }

  return (
    <SettingsSection
      headingId="deletion-heading"
      title="Delete account"
      description="Closing your account removes your profile, photos, and identity documents."
    >
      {!summary ? (
        <p className="text-meta">Checking your account.</p>
      ) : summary.deleted ? (
        <p className="text-body muted">This account is already closed.</p>
      ) : (
        <div className="settings-row settings-row-choice">
          <div className="settings-row-copy">
            <strong>Delete my account</strong>
            <span>
              {summary.canDelete
                ? 'Your profile, photos, posts, saved items, bank details, and identity images are removed. Ratings and financial records stay without your personal details.'
                : 'Finish the items below before deleting your account.'}
            </span>
            {summary.blockers.length > 0 ? (
              <ul className="text-meta" aria-label="Items to finish before deleting">
                {summary.blockers.map((blocker) => (
                  <li key={blocker.code}>{blocker.description}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <Button
            intent="danger"
            disabled={!summary.canDelete}
            onClick={() => setOpen(true)}
          >
            <Trash2 size={17} aria-hidden="true" />
            Delete account
          </Button>
        </div>
      )}

      <p className="text-meta">
        You can also read the deletion steps at /account-deletion before deciding.
      </p>

      <Dialog
        open={open}
        onClose={closeDialog}
        title="Delete your account?"
        description="This cannot be undone. Type DELETE to confirm."
        busy={busy}
        size="small"
        footer={(
          <>
            <Button intent="ghost" onClick={closeDialog} disabled={busy}>Cancel</Button>
            <Button
              intent="danger"
              loading={busy}
              loadingLabel="Deleting"
              disabled={!canConfirmDeletion(confirmation)}
              onClick={() => void handleDelete()}
            >
              Delete account
            </Button>
          </>
        )}
      >
        <div className="settings-stack">
          <p className="text-body muted">
            Your profile, username, bio, location, photos, posts, saved items, push tokens, bank details,
            and identity images are deleted. Ratings, bookings, and payment records stay so earnings and
            payouts remain correct, but they no longer show your name or photo.
          </p>
          <label className="text-meta" htmlFor="account-deletion-confirmation">
            Type {ACCOUNT_DELETION_CONFIRMATION} to confirm
          </label>
          <input
            id="account-deletion-confirmation"
            className="field"
            value={confirmation}
            autoComplete="off"
            spellCheck={false}
            data-dialog-initial
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={busy}
          />
          {error ? <p className="text-meta" role="alert">{error}</p> : null}
        </div>
      </Dialog>
    </SettingsSection>
  )
}
