import { describe, expect, it } from 'vitest'
import { activePrimaryNavigation, isWorkspacePath, primaryNavigation } from './navigation'

describe('application navigation', () => {
  it('keeps frequent member destinations in a stable order', () => {
    expect(primaryNavigation.map(({ label, to }) => ({ label, to }))).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Explore', to: '/discover' },
      { label: 'Messages', to: '/messages' },
      { label: 'Bookings', to: '/app' },
    ])
  })

  it('treats the social alias as Home', () => {
    expect(activePrimaryNavigation('/')).toBe('home')
    expect(activePrimaryNavigation('/social')).toBe('home')
  })

  it('matches messages and booking paths without confusing host profiles', () => {
    expect(activePrimaryNavigation('/messages')).toBe('messages')
    expect(activePrimaryNavigation('/messages/thread')).toBe('messages')
    expect(activePrimaryNavigation('/app')).toBe('bookings')
    expect(activePrimaryNavigation('/app/thread')).toBe('bookings')
    expect(activePrimaryNavigation('/host')).toBeNull()
    expect(activePrimaryNavigation('/host-profile')).toBe('discover')
    expect(activePrimaryNavigation('/nearby')).toBe('discover')
  })

  it('leaves account and admin destinations outside the primary navigation', () => {
    expect(activePrimaryNavigation('/profile')).toBeNull()
    expect(activePrimaryNavigation('/onboarding')).toBeNull()
    expect(activePrimaryNavigation('/admin')).toBeNull()
    expect(primaryNavigation.some(({ to }) => to.startsWith('/admin'))).toBe(false)
  })

  it('keeps operational routes off the public footer surface', () => {
    expect(isWorkspacePath('/app')).toBe(true)
    expect(isWorkspacePath('/profile')).toBe(true)
    expect(isWorkspacePath('/messages')).toBe(true)
    expect(isWorkspacePath('/host')).toBe(true)
    expect(isWorkspacePath('/nearby')).toBe(true)
    expect(isWorkspacePath('/discover')).toBe(false)
  })
})
