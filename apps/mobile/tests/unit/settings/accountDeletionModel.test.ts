import {
  ACCOUNT_DELETION_CONFIRMATION,
  accountDeletionRow,
  beginAccountDeletion,
  canConfirmAccountDeletion,
  completeAccountDeletionShutdown,
  deletionShutdown,
  finishAccountDeletion,
  isAccountDeletionInProgress,
} from '@/features/settings/accountDeletionModel'

describe('account deletion settings model', () => {
  it('requires the exact confirmation word, ignoring case and surrounding spaces', () => {
    expect(ACCOUNT_DELETION_CONFIRMATION).toBe('DELETE')
    expect(canConfirmAccountDeletion('DELETE')).toBe(true)
    expect(canConfirmAccountDeletion('  delete  ')).toBe(true)
    expect(canConfirmAccountDeletion('delete my account')).toBe(false)
    expect(canConfirmAccountDeletion('')).toBe(false)
  })

  it('disables the row while the account is loading', () => {
    expect(accountDeletionRow(null)).toMatchObject({ disabled: true, detail: 'Checking your account.' })
  })

  it('disables the row and shows the first blocker when money or an experience is open', () => {
    const row = accountDeletionRow({
      deleted: false,
      canDelete: false,
      blockers: [
        { code: 'wallet_balance', title: 'Wallet balance still open', description: 'Withdraw or spend it first.' },
        { code: 'open_booking', title: 'Experience still open', description: 'Finish it first.' },
      ],
    })
    expect(row.disabled).toBe(true)
    expect(row.detail).toBe('Withdraw or spend it first.')
  })

  it('enables the row when nothing blocks deletion', () => {
    const row = accountDeletionRow({ deleted: false, canDelete: true, blockers: [] })
    expect(row.disabled).toBe(false)
    expect(row.detail).toContain('identity images')
  })

  it('keeps a deleted account closed', () => {
    const row = accountDeletionRow({ deleted: true, canDelete: false, blockers: [] })
    expect(row).toMatchObject({ disabled: true, detail: 'This account is already closed.' })
  })

  it('navigates instead of signing out after Clerk deletes the identity', () => {
    // Signing out of a session Clerk already ended crashed the Android app.
    expect(deletionShutdown({ identityDeleted: true })).toBe('navigate')
    expect(deletionShutdown({ identityDeleted: false })).toBe('signOut')
  })

  it('skips sign-out and goes to auth when Clerk already deleted the identity', async () => {
    const signOut = jest.fn(async () => undefined)
    const navigateToAuth = jest.fn()

    await completeAccountDeletionShutdown({ identityDeleted: true, signOut, navigateToAuth })

    expect(signOut).not.toHaveBeenCalled()
    expect(navigateToAuth).toHaveBeenCalledTimes(1)
  })

  it('runs fallback sign-out and still routes to auth even if sign-out fails', async () => {
    const signOut = jest.fn(async () => { throw new Error('session closed') })
    const navigateToAuth = jest.fn()

    await completeAccountDeletionShutdown({ identityDeleted: false, signOut, navigateToAuth })

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(navigateToAuth).toHaveBeenCalledTimes(1)
  })

  it('tracks active account deletions without leaking state', () => {
    expect(isAccountDeletionInProgress()).toBe(false)
    beginAccountDeletion()
    expect(isAccountDeletionInProgress()).toBe(true)
    finishAccountDeletion()
    expect(isAccountDeletionInProgress()).toBe(false)
    finishAccountDeletion()
    expect(isAccountDeletionInProgress()).toBe(false)
  })
})
