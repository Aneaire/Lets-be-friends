// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  summary: null as unknown,
  deleteAccount: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    accountDeletion: {
      deletionSummary: 'accountDeletion.deletionSummary',
      deleteAccount: 'accountDeletion.deleteAccount',
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (query: string) => query === 'accountDeletion.deletionSummary' ? state.summary : undefined,
  useMutation: () => state.deleteAccount,
}))

vi.mock('@clerk/react', () => ({
  useClerk: () => ({ signOut: state.signOut }),
  useUser: () => ({ user: { delete: state.deleteUser } }),
}))

import { AccountDeletionSection, canConfirmDeletion } from '../../src/features/settings/AccountDeletionSection'

const readySummary = { deleted: false, canDelete: true, blockers: [], counts: { publicPosts: 2, conversations: 1, experiences: 1, identityImages: 2 } }

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: /delete account/i }))
  return screen.getByRole('dialog')
}

beforeEach(() => {
  state.summary = readySummary
  state.deleteAccount.mockReset()
  state.signOut.mockReset()
  state.deleteUser.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('account deletion settings', () => {
  it('requires the exact DELETE word before enabling confirmation', () => {
    expect(canConfirmDeletion('DELETE')).toBe(true)
    expect(canConfirmDeletion(' delete ')).toBe(true)
    expect(canConfirmDeletion('delete my account')).toBe(false)
  })

  it('disables deletion and explains each open blocker', () => {
    state.summary = {
      deleted: false,
      canDelete: false,
      blockers: [
        { code: 'wallet_balance', title: 'Wallet balance still open', description: 'You still have ₱250.00 in your wallet. Withdraw or spend it before deleting your account.' },
        { code: 'open_booking', title: 'Experience still open', description: 'You have an experience request in progress.' },
      ],
      counts: { publicPosts: 0, conversations: 0, experiences: 1, identityImages: 0 },
    }
    render(<AccountDeletionSection />)

    expect(screen.getByRole('button', { name: /delete account/i }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/Withdraw or spend it/).textContent).toContain('₱250.00')
    expect(screen.getByText(/experience request in progress/)).toBeTruthy()
  })

  it('erases the account, removes the sign-in identity, and signs out', async () => {
    state.deleteAccount.mockResolvedValue({ deleted: true, alreadyDeleted: false })
    state.deleteUser.mockResolvedValue(undefined)
    state.signOut.mockResolvedValue(undefined)
    render(<AccountDeletionSection />)

    const dialog = openDialog()
    fireEvent.change(within(dialog).getByLabelText(/type delete to confirm/i), { target: { value: 'delete' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete account$/i }))

    await waitFor(() => expect(state.deleteAccount).toHaveBeenCalledWith({ confirmation: 'DELETE' }))
    await waitFor(() => expect(state.deleteUser).toHaveBeenCalled())
    await waitFor(() => expect(state.signOut).toHaveBeenCalledWith({ redirectUrl: '/account-deletion?deleted=1' }))
  })

  it('keeps the dialog open and reports the server reason when deletion is refused', async () => {
    state.deleteAccount.mockRejectedValue(new Error('You still have ₱250.00 in your wallet.'))
    render(<AccountDeletionSection />)

    const dialog = openDialog()
    fireEvent.change(within(dialog).getByLabelText(/type delete to confirm/i), { target: { value: 'DELETE' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete account$/i }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert.textContent).toContain('₱250.00')
    expect(state.deleteUser).not.toHaveBeenCalled()
    expect(state.signOut).not.toHaveBeenCalled()
  })
})
