// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CircleSafetyConsole, type CircleSafetyDetail, type CircleSafetyListItem } from '../../src/features/circles/CircleSafetyConsole'

afterEach(cleanup)

const circle: CircleSafetyListItem = {
  _id: 'circle-1',
  slug: 'coffee-friends',
  name: 'Coffee Friends',
  category: 'Coffee',
  mode: 'both',
  approximateArea: 'Cebu',
  state: 'active',
  host: { displayName: 'Current Host', suspended: false },
  activeMemberCount: 2,
  pendingJoinCount: 0,
  hasPendingTransfer: true,
  updatedAt: 1,
}

const detail: CircleSafetyDetail = {
  circle: {
    _id: circle._id, slug: circle.slug, name: circle.name, purpose: 'Talk about coffee.', category: circle.category,
    rules: ['Be kind.'], mode: circle.mode, approximateArea: circle.approximateArea, state: circle.state, updatedAt: circle.updatedAt,
  },
  host: { displayName: 'Current Host', suspended: false, identityApproved: true },
  pendingTransfer: { displayName: 'Next Host' },
  memberships: [{
    membershipId: 'membership-1', userId: 'user-2', displayName: 'Next Host', username: 'next-host',
    accountRole: 'member', accountSuspended: false, state: 'active', role: 'member', identityApproved: true, updatedAt: 1,
  }],
  posts: [{ postId: 'post-1', authorDisplayName: 'Next Host', body: 'Private Circle post', circleKind: 'discussion', hidden: false, createdAt: 1 }],
  emergencyHostCandidates: [{ userId: 'user-2', displayName: 'Next Host' }],
}

function renderConsole(overrides: Partial<Parameters<typeof CircleSafetyConsole>[0]> = {}) {
  const props: Parameters<typeof CircleSafetyConsole>[0] = {
    allowed: true,
    rows: [circle],
    detail,
    selectedCircleId: circle._id,
    stateFilter: 'all',
    search: '',
    onStateFilterChange: vi.fn(),
    onSearchChange: vi.fn(),
    onSelect: vi.fn(),
    onSetState: vi.fn().mockResolvedValue(undefined),
    onCancelTransfer: vi.fn().mockResolvedValue(undefined),
    onRecoverHost: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<CircleSafetyConsole {...props} />)
  return props
}

describe('Circle safety console', () => {
  it('blocks reviewers from the general Circle console', () => {
    renderConsole({ allowed: false, rows: undefined, detail: undefined })
    expect(screen.getByText('Circle safety is available only to full admins.')).toBeTruthy()
    expect(screen.queryByText('Private Circle post')).toBeNull()
  })

  it('requires confirmation before a full admin suspends a Circle', async () => {
    const props = renderConsole()
    fireEvent.click(screen.getByRole('button', { name: 'Suspend Circle' }))
    expect(screen.getByRole('dialog').textContent).toContain('Members will lose access to Circle content')
    expect(props.onSetState).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm suspension' }))
    await waitFor(() => expect(props.onSetState).toHaveBeenCalledWith('circle-1', 'suspended'))
    expect(screen.getByRole('status').textContent).toContain('Circle suspended.')
  })

  it('labels and confirms emergency ownership recovery', async () => {
    const props = renderConsole()
    fireEvent.click(screen.getByRole('button', { name: 'Emergency ownership recovery' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Use this only when the current host cannot act.')
    fireEvent.change(screen.getByLabelText('New host'), { target: { value: 'user-2' } })
    fireEvent.change(screen.getByLabelText('Internal reason'), { target: { value: 'Current host lost account access.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm recovery' }))
    await waitFor(() => expect(props.onRecoverHost).toHaveBeenCalledWith('circle-1', 'user-2', 'Current host lost account access.'))
  })

  it('announces mutation errors', async () => {
    renderConsole({ onCancelTransfer: vi.fn().mockRejectedValue(new Error('Transfer changed. Refresh and try again.')) })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel stuck transfer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Transfer changed. Refresh and try again.')
  })

  it('confirms before cancelling a stuck transfer', async () => {
    const props = renderConsole()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel stuck transfer' }))
    expect(props.onCancelTransfer).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toContain('Next Host will no longer be able to accept ownership.')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    await waitFor(() => expect(props.onCancelTransfer).toHaveBeenCalledWith('circle-1'))
  })

  it('names an archived restore target', async () => {
    const props = renderConsole({
      detail: { ...detail, circle: { ...detail.circle, state: 'suspended', restoreState: 'archived' } },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Restore as archived' }))
    await waitFor(() => expect(props.onSetState).toHaveBeenCalledWith('circle-1', 'active'))
    expect(screen.getByRole('status').textContent).toContain('Circle restored as archived.')
  })

  it('shows privacy settings and media links for review', () => {
    renderConsole({
      rows: [{ ...circle, settings: { discoverability: 'unlisted', discussionVisibility: 'signed_in', memberListVisibility: 'signed_in', joinPolicy: 'open' }, hasIcon: true, hasCover: false }],
      detail: {
        ...detail,
        circle: {
          ...detail.circle,
          settings: { discoverability: 'unlisted', discussionVisibility: 'signed_in', memberListVisibility: 'signed_in', joinPolicy: 'open' },
          iconUrl: 'https://example.invalid/icon.png',
        },
      },
    })
    expect(screen.getAllByText('Unlisted').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Open join')).toBeTruthy()
    expect(screen.getAllByText('Signed in').length).toBe(2)
    expect(screen.getByText('Open')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View icon' })).toHaveProperty('href', 'https://example.invalid/icon.png')
    expect(screen.getByText('None')).toBeTruthy()
  })

  it('falls back to legacy defaults when settings are missing', () => {
    renderConsole()
    expect(screen.getByText('Listed (legacy default)')).toBeTruthy()
    expect(screen.getAllByText('Members only (legacy default)').length).toBe(2)
    expect(screen.getByText('Approval required (legacy default)')).toBeTruthy()
  })
})
