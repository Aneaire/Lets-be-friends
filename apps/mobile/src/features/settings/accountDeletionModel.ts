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
