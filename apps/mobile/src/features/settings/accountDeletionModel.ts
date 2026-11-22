export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE'

export type AccountDeletionBlocker = {
  code: string
  title: string
  description: string
}

export type AccountDeletionSummary = {
  deleted: boolean
  canDelete: boolean
  blockers: AccountDeletionBlocker[]
}

export function canConfirmAccountDeletion(value: string) {
  return value.trim().toUpperCase() === ACCOUNT_DELETION_CONFIRMATION
}

/**
 * After Clerk deletes the identity the session is already over. Calling
 * signOut() on that dead session crashed the Android app, so deletion decides
 * between navigating to the signed-out screen and running the normal sign-out.
 */
export function deletionShutdown({ identityDeleted }: { identityDeleted: boolean }): 'navigate' | 'signOut' {
  return identityDeleted ? 'navigate' : 'signOut'
}

let activeAccountDeletions = 0

export function beginAccountDeletion() {
  activeAccountDeletions += 1
}

export function finishAccountDeletion() {
  activeAccountDeletions = Math.max(0, activeAccountDeletions - 1)
}

export function isAccountDeletionInProgress() {
  return activeAccountDeletions > 0
}

/**
 * Finishes leaving the app after Convex erases the member record. This runs
 * even if the settings screen already unmounted when the account flipped to
 * suspended, so fallback sign-out must not depend on component mount state.
 */
export async function completeAccountDeletionShutdown({
  identityDeleted,
  signOut,
  navigateToAuth,
}: {
  identityDeleted: boolean
  signOut: () => Promise<void>
  navigateToAuth: () => void
}) {
  if (deletionShutdown({ identityDeleted }) === 'signOut') {
    try {
      await signOut()
    } catch {
      // The account is already erased on the server and the session may already
      // be closed. Still move the user to the signed-out screen.
    }
  }
  navigateToAuth()
}

export function accountDeletionRow(summary: AccountDeletionSummary | null | undefined) {
  if (!summary) {
    return { label: 'Delete account', detail: 'Checking your account.', disabled: true }
  }
  if (summary.deleted) {
    return { label: 'Delete account', detail: 'This account is already closed.', disabled: true }
  }
  if (!summary.canDelete) {
    return {
      label: 'Delete account',
      detail: summary.blockers[0]?.description ?? 'Finish open items before deleting your account.',
      disabled: true,
    }
  }
  return {
    label: 'Delete account',
    detail: 'Remove your profile, photos, posts, bank details, and identity images.',
    disabled: false,
  }
}
