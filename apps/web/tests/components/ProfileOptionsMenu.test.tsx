// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  relationship: undefined as { blocked: boolean; muted: boolean; blockedByOther: boolean } | undefined,
  setMuted: vi.fn(async () => true),
  setBlocked: vi.fn(async () => true),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    safety: {
      relationship: 'safety.relationship',
      setMuted: 'safety.setMuted',
      setBlocked: 'safety.setBlocked',
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: () => state.relationship,
  useMutation: (name: string) => (name === 'safety.setMuted' ? state.setMuted : state.setBlocked),
}))

import { ProfileOptionsMenu } from '../../src/features/safety/ProfileOptionsMenu'

function renderMenu(overrides: Partial<Parameters<typeof ProfileOptionsMenu>[0]> = {}) {
  const props = {
    userId: 'user-1' as Parameters<typeof ProfileOptionsMenu>[0]['userId'],
    displayName: 'Dana Cruz',
    following: false,
    saved: false,
    onToggleFollow: vi.fn(),
    onToggleSave: vi.fn(),
    onReport: vi.fn(),
    onNotice: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  }
  render(<ProfileOptionsMenu {...props} />)
  return props
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Dana Cruz profile options' }))
}

beforeEach(() => {
  state.relationship = { blocked: false, muted: false, blockedByOther: false }
  state.setMuted = vi.fn(async () => true)
  state.setBlocked = vi.fn(async () => true)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Profile options menu', () => {
  it('keeps secondary and safety actions behind one menu', () => {
    renderMenu()
    openMenu()

    expect(screen.getByRole('menu', { name: 'Profile options' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Follow' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Save profile' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Mute' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Block member' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Report this profile' })).toBeTruthy()
  })

  it('runs follow, save, and report from the menu', () => {
    const props = renderMenu({ following: true, saved: true })
    openMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Unfollow' }))
    expect(props.onToggleFollow).toHaveBeenCalledTimes(1)

    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from saved' }))
    expect(props.onToggleSave).toHaveBeenCalledTimes(1)

    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Report this profile' }))
    expect(props.onReport).toHaveBeenCalledTimes(1)
  })

  it('waits for the relationship before enabling mute and block', () => {
    state.relationship = undefined
    renderMenu()
    openMenu()

    expect((screen.getByRole('menuitem', { name: 'Mute' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('menuitem', { name: 'Block member' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('mutes a member and reports the change', async () => {
    const props = renderMenu()
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mute' }))

    await waitFor(() => expect(state.setMuted).toHaveBeenCalledWith({ userId: 'user-1', muted: true }))
    expect(props.onNotice).toHaveBeenCalledWith('Dana Cruz is muted. Their posts are hidden and their notifications stopped.')
  })

  it('asks before blocking and then blocks the member', async () => {
    const props = renderMenu()
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Block member' }))

    expect(await screen.findByRole('dialog', { name: 'Block Dana Cruz?' })).toBeTruthy()
    expect(state.setBlocked).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Block member' }))

    await waitFor(() => expect(state.setBlocked).toHaveBeenCalledWith({ userId: 'user-1', blocked: true }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(props.onNotice).toHaveBeenCalledWith('Dana Cruz is blocked.')
  })

  it('keeps the block dialog open and explains a failed change', async () => {
    state.setBlocked = vi.fn(async () => { throw new Error('Contact is unavailable') })
    renderMenu()
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Block member' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Block member' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Contact is unavailable')
    expect(screen.getByRole('dialog', { name: 'Block Dana Cruz?' })).toBeTruthy()
  })

  it('offers to unblock an already blocked member', async () => {
    state.relationship = { blocked: true, muted: false, blockedByOther: false }
    renderMenu()
    openMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Unblock member' }))
    expect(await screen.findByRole('dialog', { name: 'Unblock Dana Cruz?' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Unblock member' }))

    await waitFor(() => expect(state.setBlocked).toHaveBeenCalledWith({ userId: 'user-1', blocked: false }))
  })
})
