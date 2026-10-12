// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const circleDraftKey = 'lets-be-friends-circle-create-draft-v1'

beforeEach(() => window.localStorage.clear())
afterEach(() => { cleanup(); window.localStorage.clear(); vi.resetAllMocks() })

describe('Circle creation', () => {
  it('fills and normalizes the URL slug as the Circle name is typed', async () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    render(<CircleIndexPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    const slug = screen.getByLabelText(/URL slug/) as HTMLInputElement
    fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: 'Meet nearby friends.' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Community' } })
    fireEvent.change(screen.getByLabelText('Rule 1'), { target: { value: 'Be respectful.' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: "  Café & Pampanga Meet Up's  " } })

    expect(slug.value).toBe('cafe-pampanga-meet-up-s')
    await waitFor(() => expect((screen.getAllByRole('button', { name: 'Create Circle' }).at(-1) as HTMLButtonElement).disabled).toBe(false))
  })

  it('keeps a manually edited slug until it is cleared, then resumes autofill', () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    render(<CircleIndexPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    const name = screen.getByLabelText('Name')
    const slug = screen.getByLabelText(/URL slug/) as HTMLInputElement
    fireEvent.change(name, { target: { value: 'Coffee Friends' } })
    fireEvent.change(slug, { target: { value: 'local-hosts' } })
    fireEvent.change(name, { target: { value: 'Coffee Friends Cebu' } })
    expect(slug.value).toBe('local-hosts')

    fireEvent.change(slug, { target: { value: '' } })
    fireEvent.change(name, { target: { value: 'Coffee Friends Cebu City' } })
    expect(slug.value).toBe('coffee-friends-cebu-city')
  })

  it('filters unsupported slug characters and malformed hyphens while typing', () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    render(<CircleIndexPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    const slug = screen.getByLabelText(/URL slug/) as HTMLInputElement
    fireEvent.change(slug, { target: { value: '--Cebu Coffee@@@--Friends!' } })

    expect(slug.value).toBe('cebucoffee-friends')
  })

  it('keeps the draft when the form is canceled and reopened', () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    render(<CircleIndexPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pampanga Walks' } })
    fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: 'Plan relaxed weekend walks.' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Outdoors' } })
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'in_person' } })
    fireEvent.change(screen.getByLabelText(/^Approximate area/), { target: { value: 'San Fernando' } })
    fireEvent.change(screen.getByLabelText('Rule 1'), { target: { value: 'Respect everyone\'s pace.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('heading', { name: 'Create a Circle' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Pampanga Walks')
    expect(screen.getByLabelText(/URL slug/)).toHaveProperty('value', 'pampanga-walks')
    expect(screen.getByLabelText('Purpose')).toHaveProperty('value', 'Plan relaxed weekend walks.')
    expect(screen.getByLabelText('Category')).toHaveProperty('value', 'Outdoors')
    expect(screen.getByLabelText('Mode')).toHaveProperty('value', 'in_person')
    expect(screen.getByLabelText(/^Approximate area/)).toHaveProperty('value', 'San Fernando')
    expect(screen.getByLabelText('Rule 1')).toHaveProperty('value', "Respect everyone's pace.")
  })

  it('restores a safely stored draft after the page is remounted', async () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    const page = render(<CircleIndexPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Coffee Learners' } })
    fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: 'Learn brewing together.' } })
    fireEvent.change(screen.getByLabelText('Rule 1'), { target: { value: 'Share the table.' } })
    await waitFor(() => expect(window.localStorage.getItem(circleDraftKey)).not.toBeNull())

    page.unmount()
    render(<CircleIndexPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Coffee Learners'))
    expect(screen.getByLabelText(/URL slug/)).toHaveProperty('value', 'coffee-learners')
    expect(screen.getByLabelText('Purpose')).toHaveProperty('value', 'Learn brewing together.')
    expect(screen.getByLabelText('Rule 1')).toHaveProperty('value', 'Share the table.')
  })

  it('ignores a malformed saved draft', () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    window.localStorage.setItem(circleDraftKey, '{"name":')

    render(<CircleIndexPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))

    expect(screen.getByLabelText('Name')).toHaveProperty('value', '')
    expect(screen.getByText('Still needed: Name, URL slug, Purpose, Category, at least one Circle rule.')).toBeTruthy()
  })

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

  it('enables creation only when every required field and a custom rule are valid', async () => {
    mocks.query.mockImplementation((fn) => fn === 'circles.creationEligibility' ? { eligible: true, reason: null } : [])
    render(<CircleIndexPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }))
    const submit = screen.getAllByRole('button', { name: 'Create Circle' }).at(-1) as HTMLButtonElement
    expect(screen.getByText('Still needed: Name, URL slug, Purpose, Category, at least one Circle rule.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Rule 1'), { target: { value: 'Be respectful.' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Study Friends' } })
    fireEvent.change(screen.getByLabelText(/URL slug/), { target: { value: '-' } })
    fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: 'Study together.' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Learning' } })
    await waitFor(() => expect(submit.disabled).toBe(true))

    fireEvent.change(screen.getByLabelText(/URL slug/), { target: { value: 'study-friends' } })
    await waitFor(() => expect(submit.disabled).toBe(false))
    expect(screen.getByText('Everything required is filled in. You can create your Circle now.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: '' } })
    await waitFor(() => expect(submit.disabled).toBe(true))
    expect(screen.getByText('Still needed: Purpose.')).toBeTruthy()
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
    await waitFor(() => expect(window.localStorage.getItem(circleDraftKey)).not.toBeNull())
    fireEvent.click(screen.getAllByRole('button', { name: 'Create Circle' }).at(-1)!)

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Study Friends', slug: 'study-friends', purpose: 'Study together.', category: 'Learning', rules: ['Be respectful.'],
    })))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/circles/$circleId', params: { circleId: 'circle-new' } })
    await waitFor(() => expect(window.localStorage.getItem(circleDraftKey)).toBeNull())
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
