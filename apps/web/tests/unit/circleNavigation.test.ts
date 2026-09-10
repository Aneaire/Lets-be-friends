import { describe, expect, it } from 'vitest'
import { activePrimaryNavigation, isWorkspacePath, mobileNavigation, primaryNavigation, sidebarNavigation } from '../../src/lib/navigation'

describe('Circle navigation', () => {
  it('uses the desktop rail and keeps Circles out of the four mobile link destinations', () => {
    expect(sidebarNavigation.map((item) => item.id)).toEqual(['home', 'discover', 'circles'])
    expect(primaryNavigation.map((item) => item.id)).toEqual(['home', 'discover', 'circles', 'messages', 'bookings'])
    expect(mobileNavigation.map((item) => item.id)).toEqual(['home', 'discover', 'messages', 'bookings'])
  })

  it('marks Circle index and workspace routes active', () => {
    expect(activePrimaryNavigation('/circles')).toBe('circles')
    expect(activePrimaryNavigation('/circles/circle-1')).toBe('circles')
    expect(isWorkspacePath('/circles/circle-1')).toBe(true)
  })
})
