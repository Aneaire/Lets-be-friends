import { describe, expect, it } from 'vitest'
import { activePrimaryNavigation, headerNavigation, isWorkspacePath, primaryNavigation, sidebarNavigation } from '../../src/lib/navigation'

describe('application navigation', () => {
  it('keeps frequent member destinations in a stable order', () => {
    expect(primaryNavigation.map(({ label, to }) => ({ label, to }))).toEqual([
      { label: 'Home', to: '/social' },
      { label: 'Explore', to: '/discover' },
      { label: 'Messages', to: '/messages' },
      { label: 'Bookings', to: '/app' },
    ])
  })

  it('keeps the sidebar focused on discovery destinations', () => {
    expect(sidebarNavigation.map(({ label, to }) => ({ label, to }))).toEqual([
      { label: 'Home', to: '/social' },
      { label: 'Explore', to: '/discover' },
    ])
  })

  it('keeps messages and bookings in the signed-in header', () => {
    expect(headerNavigation.map(({ label, to }) => ({ label, to }))).toEqual([
      { label: 'Messages', to: '/messages' },
      { label: 'Bookings', to: '/app' },
    ])
  })
  it('treats the public landing route and social feed as Home', () => {
    expect(activePrimaryNavigation('/')).toBe('home')
    expect(activePrimaryNavigation('/social')).toBe('home')
  })

  it('matches messages and booking paths without confusing companion profiles', () => {
    expect(activePrimaryNavigation('/messages')).toBe('messages')
    expect(activePrimaryNavigation('/messages/thread')).toBe('messages')
    expect(activePrimaryNavigation('/app')).toBe('bookings')
    expect(activePrimaryNavigation('/app/thread')).toBe('bookings')
    expect(activePrimaryNavigation('/companion')).toBeNull()
    expect(activePrimaryNavigation('/companion-profile')).toBe('discover')
    expect(activePrimaryNavigation('/nearby')).toBe('discover')
  })

  it('leaves account and admin destinations outside the primary navigation', () => {
    expect(activePrimaryNavigation('/profile')).toBeNull()
    expect(activePrimaryNavigation('/settings')).toBeNull()
    expect(activePrimaryNavigation('/onboarding')).toBeNull()
    expect(activePrimaryNavigation('/admin')).toBeNull()
    expect(primaryNavigation.some(({ to }) => to.startsWith('/admin'))).toBe(false)
  })

  it('keeps operational routes off the public footer surface', () => {
    expect(isWorkspacePath('/app')).toBe(true)
    expect(isWorkspacePath('/profile')).toBe(true)
    expect(isWorkspacePath('/settings')).toBe(true)
    expect(isWorkspacePath('/messages')).toBe(true)
    expect(isWorkspacePath('/companion')).toBe(true)
    expect(isWorkspacePath('/wallet')).toBe(true)
    expect(isWorkspacePath('/get-verified')).toBe(true)
    expect(isWorkspacePath('/nearby')).toBe(true)
    expect(isWorkspacePath('/discover')).toBe(false)
  })
})
