// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null | undefined,
  restart: vi.fn(async () => ({ mode: 'restarted' })),
  confirmFields: vi.fn(async () => undefined),
  navigate: vi.fn(async () => undefined),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    identityRecords: {
      current: 'identityRecords.current',
      start: 'identityRecords.start',
      uploadImage: 'identityRecords.uploadImage',
      extract: 'identityRecords.extract',
      confirmFields: 'identityRecords.confirmFields',
      restartAttempt: 'identityRecords.restartAttempt',
      issueSelfieCaptureToken: 'identityRecords.issueSelfieCaptureToken',
      submit: 'identityRecords.submit',
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (query: string) => (query === 'identityRecords.current' ? state.current : undefined),
  useMutation: (mutation: string) => {
    if (mutation === 'identityRecords.restartAttempt') return state.restart
    if (mutation === 'identityRecords.confirmFields') return state.confirmFields
    return vi.fn(async () => undefined)
  },
  useAction: () => vi.fn(async () => ({})),
}))

vi.mock('@clerk/react', () => ({
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ isSignedIn: true, userId: 'user_test' }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => state.navigate,
  useLocation: () => ({ pathname: '/profile' }),
}))

import { IdentityVerificationPage } from '../../src/features/identity/IdentityVerificationFlow'

function renderPage() {
  return render(<IdentityVerificationPage intent="member" returnTo="/profile" />)
}

describe('identity verification restart control', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    state.restart.mockClear()
    state.current = {
      _id: 'record-1',
      reason: 'member',
      stage: 'confirmation_required',
      selectedIdType: 'drivers_license',
      extraction: { fullLegalName: '', dateOfBirth: '' },
      fieldsConfirmedAt: undefined,
      imageKinds: ['id_front', 'selfie'],
      updatedAt: Date.now(),
    }
  })

  afterEach(() => {
    cleanup()
    window.sessionStorage.clear()
  })

  it('offers a different photo on the details step and calls restartAttempt', async () => {
    renderPage()

    // Stage confirmation_required with both images already stored lands on the
    // selfie step first, which is where the member continues from.
    fireEvent.click(await screen.findByRole('button', { name: 'Continue to your details' }))

    const restart = await screen.findByRole('button', { name: 'Use a different photo' })
    // It must not be the primary action: saving and restarting are different intents.
    expect(restart.className).toBe('identity-edit-details')
    expect(screen.getByRole('button', { name: 'Save and check details' })).toBeTruthy()

    fireEvent.click(restart)
    await waitFor(() => expect(state.restart).toHaveBeenCalledWith({ identityRecordId: 'record-1' }))
  })

  it('does not offer the restart control before the details step', async () => {
    renderPage()
    await screen.findByRole('button', { name: 'Continue to your details' })
    expect(screen.queryByRole('button', { name: 'Use a different photo' })).toBeNull()
  })

  it('returns to the upload step once the record is back in draft', async () => {
    const view = renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Continue to your details' }))
    await screen.findByRole('button', { name: 'Use a different photo' })
    expect(screen.queryByText('Government ID type')).toBeNull()

    // The server drives the stage, so the upload controls must come back once the
    // record is reset to draft.
    state.current = { ...state.current, stage: 'draft', extraction: undefined, imageKinds: [] }
    view.rerender(<IdentityVerificationPage intent="member" returnTo="/profile" />)

    await waitFor(() => expect(screen.getByText('Government ID type')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Use a different photo' })).toBeNull()
  })
})
