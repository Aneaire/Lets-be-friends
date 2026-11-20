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
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => state.navigate,
  useLocation: () => ({ pathname: '/profile' }),
}))

import { IdentityVerificationPage } from '../../src/features/identity/IdentityVerificationFlow'

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

function renderPage() {
  return render(<IdentityVerificationPage intent="member" returnTo="/profile" />)
}

describe('identity verification restart control', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    URL.createObjectURL = vi.fn(() => 'blob:identity-photo') as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
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
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
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

describe('identity verification photo previews', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    URL.createObjectURL = vi.fn(() => 'blob:identity-photo') as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
    state.current = {
      _id: 'record-1',
      reason: 'member',
      stage: 'draft',
      selectedIdType: 'drivers_license',
      extraction: undefined,
      fieldsConfirmedAt: undefined,
      imageKinds: [],
      updatedAt: Date.now(),
    }
  })

  afterEach(() => {
    cleanup()
    window.sessionStorage.clear()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('renders the chosen ID photo so the member can confirm the image', async () => {
    renderPage()
    await screen.findByText('Government ID type')

    const input = document.getElementById('identity-front') as HTMLInputElement
    // The upload step only holds the file locally, so the preview must come from
    // the member's own selection.
    fireEvent.change(input, { target: { files: [new File(['front'], 'id-front.jpg', { type: 'image/jpeg' })] } })

    expect((await screen.findByAltText('Front of ID preview')).getAttribute('src')).toBe('blob:identity-photo')
    expect(screen.getByText('id-front.jpg')).toBeTruthy()
    expect(screen.getByText('Choose another photo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open Front of ID larger' })).toBeTruthy()
    expect(screen.getAllByText('No photo added')).toHaveLength(1)
  })

  it('keeps the empty state until a photo is chosen', async () => {
    renderPage()
    await screen.findByText('Government ID type')

    expect(screen.getAllByText('No photo added')).toHaveLength(2)
    expect(screen.queryByAltText('Front of ID preview')).toBeNull()
  })
})

describe('identity verification unified acceptance notices', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    URL.createObjectURL = vi.fn(() => 'blob:identity-photo') as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
  })

  afterEach(() => {
    cleanup()
    window.sessionStorage.clear()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('shows the data handling disclosure before the upload action and needs no extra checkbox', async () => {
    state.current = {
      _id: 'record-1',
      reason: 'member',
      stage: 'draft',
      selectedIdType: 'drivers_license',
      extraction: undefined,
      fieldsConfirmedAt: undefined,
      imageKinds: [],
      updatedAt: Date.now(),
    }
    const { container } = renderPage()
    await screen.findByText('Government ID type')
    const text = container.textContent ?? ''
    // Google Play User Data policy: sensitive collection needs a prominent
    // in-app disclosure before the consent action, not only linked legal pages.
    expect(text).toContain('How this check handles your data')
    expect(text).toContain('Only the ID image is sent to a secure OpenAI field reader')
    expect(text).toContain('never sent to the field reader')
    expect(text).toContain('for as long as your account exists')
    expect(text).toContain('human safety team decision')
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe('/privacy-policy')
    // The labeled upload action is the affirmative consent, so no checkbox is added.
    expect(screen.queryByRole('checkbox')).toBeNull()
    // The disclosure must precede the upload button in the document.
    expect(text.indexOf('How this check handles your data')).toBeLessThan(text.indexOf('Upload and process ID'))
    const input = document.getElementById('identity-front') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['front'], 'id-front.jpg', { type: 'image/jpeg' })] } })
    const upload = await screen.findByRole('button', { name: 'Upload and process ID' })
    expect((upload as HTMLButtonElement).disabled).toBe(false)
  })

  it('keeps the data handling disclosure before the send action', async () => {
    state.current = {
      _id: 'record-1',
      reason: 'member',
      stage: 'confirmation_required',
      selectedIdType: 'drivers_license',
      extraction: { fullLegalName: 'Example Member', dateOfBirth: '1990-01-02' },
      fieldsConfirmedAt: Date.now(),
      imageKinds: ['id_front', 'selfie'],
      updatedAt: Date.now(),
    }
    const { container } = renderPage()
    const send = await screen.findByRole('button', { name: 'Send for safety review' })
    const text = container.textContent ?? ''
    expect(text).toContain('How this check handles your data')
    expect(text).toContain('Only the ID image is sent to a secure OpenAI field reader')
    expect(text).toContain('for as long as your account exists')
    expect(text.indexOf('How this check handles your data')).toBeLessThan(text.indexOf('Send for safety review'))
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect((send as HTMLButtonElement).disabled).toBe(false)
  })
})
