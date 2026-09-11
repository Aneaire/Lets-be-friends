// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn(), navigate: vi.fn() }))

vi.mock('../../convex/_generated/api', () => ({
  api: { circles: { mine: 'circles.mine', discover: 'circles.discover', creationEligibility: 'circles.creationEligibility', create: 'circles.create' } },
}))
vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mocks.query(...args),
  useMutation: () => mocks.create,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mocks.navigate,
}))

import { CircleIndexPage } from '../../src/features/circles/CircleIndexPage'

afterEach(() => { cleanup(); vi.resetAllMocks() })

describe('Circle creation', () => {
  it('adds, removes, and submits trimmed custom rules in order', async () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    mocks.create.mockResolvedValue('circle-new')
    mocks.navigate.mockResolvedValue(undefined)
    render(<CircleIndexPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    expect((screen.getByLabelText('Rule 1') as HTMLInputElement).maxLength).toBe(240)
    fireEvent.change(screen.getByLabelText('Rule 1'), { target: { value: '  Be respectful.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }))
    fireEvent.change(screen.getByLabelText('Rule 2'), { target: { value: '  Keep locations private. ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }))
    fireEvent.change(screen.getByLabelText('Rule 3'), { target: { value: 'Remove this rule' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove rule 3' }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Study Friends' } })
    fireEvent.change(screen.getByLabelText(/URL slug/), { target: { value: 'study-friends' } })
    fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: 'Study together.' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Learning' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Create Circle' }).at(-1)!)

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      rules: ['Be respectful.', 'Keep locations private.'],
    })))
  })

  it('offers optional icon and cover uploads in the creation form', () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    render(<CircleIndexPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    expect((screen.getByLabelText(/Icon.*optional/) as HTMLInputElement).accept).toBe('image/jpeg,image/png,image/webp')
    expect((screen.getByLabelText(/Cover.*optional/) as HTMLInputElement).accept).toBe('image/jpeg,image/png,image/webp')
    expect((screen.getByLabelText(/Icon.*optional/) as HTMLInputElement).type).toBe('file')
  })

  it('uploads a dropped icon and shows its preview', async () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    mocks.create.mockResolvedValue('https://upload.example')
    const originalFetch = globalThis.fetch
    const originalCreateObjectURL = URL.createObjectURL
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ storageId: 'storage-1' }) }) as unknown as typeof fetch
    URL.createObjectURL = vi.fn(() => 'blob:icon') as unknown as typeof URL.createObjectURL
    try {
      render(<CircleIndexPage />)
      fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
      fireEvent.drop(screen.getByLabelText(/Icon.*optional/), { dataTransfer: { files: [new File(['bytes'], 'icon.png', { type: 'image/png' })] } })

      await waitFor(() => expect(screen.getByAltText('icon preview')).toBeTruthy())
      expect(globalThis.fetch).toHaveBeenCalledWith('https://upload.example', expect.objectContaining({ method: 'POST' }))
    } finally {
      globalThis.fetch = originalFetch
      URL.createObjectURL = originalCreateObjectURL
    }
  })

  it('requires at least one non-empty custom rule', () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    render(<CircleIndexPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    const submit = screen.getAllByRole('button', { name: 'Create Circle' }).at(-1) as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Rule 1'), { target: { value: '   ' } })
    expect(submit.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Rule 1'), { target: { value: 'Be respectful.' } })
    expect(submit.disabled).toBe(true)
  })

  it('enables creation only when every required field and a custom rule are valid', () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    render(<CircleIndexPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    const submit = screen.getAllByRole('button', { name: 'Create Circle' }).at(-1) as HTMLButtonElement
    fireEvent.change(screen.getByLabelText('Rule 1'), { target: { value: 'Be respectful.' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Study Friends' } })
    fireEvent.change(screen.getByLabelText(/URL slug/), { target: { value: 'Invalid slug' } })
    fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: 'Study together.' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Learning' } })
    expect(submit.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/URL slug/), { target: { value: 'study-friends' } })
    expect(submit.disabled).toBe(false)

    fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: '' } })
    expect(submit.disabled).toBe(true)
  })

  it('creates a Circle from the custom-rule form and opens it', async () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    mocks.create.mockResolvedValue('circle-new')
    mocks.navigate.mockResolvedValue(undefined)
    render(<CircleIndexPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Study Friends' } })
    fireEvent.change(screen.getByLabelText(/URL slug/), { target: { value: 'study-friends' } })
    fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: 'Study together.' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Learning' } })
    fireEvent.change(screen.getByLabelText('Rule 1'), { target: { value: 'Be respectful.' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Create Circle' }).at(-1)!)

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Study Friends', slug: 'study-friends', purpose: 'Study together.', category: 'Learning', rules: ['Be respectful.'],
    })))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/circles/$circleId', params: { circleId: 'circle-new' } })
  })

  it('shows verification guidance without an enabled create submission', () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: false, reason: 'verification_required' } : [])
    render(<CircleIndexPage />)

    expect(screen.getByText('Current identity verification is required before you can create and host a Circle.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Verify to create a Circle' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create Circle' })).toBeNull()
  })

  it('does not direct an ineligible account role to identity verification', () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: false, reason: 'role_required' } : [])
    render(<CircleIndexPage />)

    expect(screen.getByText('Your account role is not eligible to create or host a Circle.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Verify to create a Circle' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Create Circle' })).toBeNull()
  })

  it('shows Circle icons and open-join badges on discovery rows', () => {
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.creationEligibility') return { eligible: false, reason: 'role_required' }
      if (fn === 'circles.discover') return [{
        _id: 'circle-open', slug: 'open', name: 'Open Circle', purpose: 'Everyone is welcome.', category: 'Coffee',
        rules: ['Be kind.'], mode: 'online', approximateArea: 'Online', memberCount: 3,
        settings: { discoverability: 'listed', discussionVisibility: 'signed_in', memberListVisibility: 'members_only', joinPolicy: 'open' },
        discoverability: 'listed', discussionVisibility: 'signed_in', memberListVisibility: 'members_only', joinPolicy: 'open',
        iconUrl: 'https://example.invalid/icon.png', coverUrl: undefined, host: null,
      }]
      return []
    })
    render(<CircleIndexPage />)

    expect(screen.getByText('Open join')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Open Circle, Online' })).toHaveProperty('src', 'https://example.invalid/icon.png')
  })

  it('announces Circle creation failures', async () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    mocks.create.mockRejectedValue(new Error('Circle slug is already taken'))
    render(<CircleIndexPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Study Friends' } })
    fireEvent.change(screen.getByLabelText(/URL slug/), { target: { value: 'study-friends' } })
    fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: 'Study together.' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Learning' } })
    fireEvent.change(screen.getByLabelText('Rule 1'), { target: { value: 'Be respectful.' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Create Circle' }).at(-1)!)

    expect((await screen.findByRole('alert')).textContent).toContain('Circle slug is already taken')
  })
})
