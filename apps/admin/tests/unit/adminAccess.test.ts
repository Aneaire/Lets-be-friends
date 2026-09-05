import { describe, expect, it } from 'vitest'
import { getAdminGateState, getAdminNavContext, getAdminNavSections } from '../../src/lib/adminAccess'

describe('admin access helpers', () => {
  it('shows full-admin navigation only to admins', () => {
    const adminRoutes = getAdminNavSections('admin').flatMap((section) => section.items.map((item) => item.to))
    const reviewerRoutes = getAdminNavSections('reviewer').flatMap((section) => section.items.map((item) => item.to))

    expect(adminRoutes).toContain('/users')
    expect(adminRoutes).toContain('/audit-logs')
    expect(adminRoutes).toContain('/settings')

    expect(reviewerRoutes).not.toContain('/users')
    expect(reviewerRoutes).not.toContain('/audit-logs')
    expect(reviewerRoutes).not.toContain('/settings')
    expect(reviewerRoutes).toContain('/companion-applications')
    expect(reviewerRoutes).toContain('/booking-verification')
    expect(reviewerRoutes).toContain('/posts')
    expect(reviewerRoutes).toContain('/profile')
  })

  it('maps auth and viewer state to admin gate states', () => {
    expect(getAdminGateState({ authLoaded: false, isSignedIn: false, viewer: undefined })).toBe('loading')
    expect(getAdminGateState({ authLoaded: true, isSignedIn: false, viewer: undefined })).toBe('signed_out')
    expect(getAdminGateState({ authLoaded: true, isSignedIn: true, viewer: undefined })).toBe('loading')
    expect(getAdminGateState({ authLoaded: true, isSignedIn: true, viewer: null })).toBe('sync_profile')
    expect(getAdminGateState({ authLoaded: true, isSignedIn: true, viewer: { role: 'member' } })).toBe('denied')
    expect(getAdminGateState({ authLoaded: true, isSignedIn: true, viewer: { role: 'admin', suspended: true } })).toBe('denied')
    expect(getAdminGateState({ authLoaded: true, isSignedIn: true, viewer: { role: 'reviewer' } })).toBe('allowed')
    expect(getAdminGateState({ authLoaded: true, isSignedIn: true, viewer: { role: 'admin' } })).toBe('allowed')
  })

  it('resolves the current page and section for workspace orientation', () => {
    expect(getAdminNavContext('admin', '/reports')).toMatchObject({
      section: 'Review',
      item: { label: 'Reports' },
    })
    expect(getAdminNavContext('reviewer', '/settings')).toBeUndefined()
  })
})
