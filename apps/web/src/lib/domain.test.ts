import { describe, expect, it } from 'vitest'
import { activityCategories, bookingStatuses, brandAccentColors, friendStrengths, isAdminRole, isModerationVisible, userRoles } from '@lets-be-friends/shared'
import { workspaceRoutes } from '../components/AppShell'

describe('shared early access domain constants', () => {
  it('keeps safe discovery defaults available', () => {
    expect(friendStrengths).toContain('Good listener')
    expect(activityCategories).toContain('Online conversation')
    expect(bookingStatuses).toContain('verification_required')
  })

  it('exports the logo accent semantics for product actions', () => {
    expect(brandAccentColors.self.hex).toBe('#1093ED')
    expect(brandAccentColors.social.hex).toBe('#C1519C')
    expect(Object.keys(brandAccentColors)).toEqual(['self', 'social'])
  })

  it('keeps roles and admin semantics explicit', () => {
    expect(userRoles).toEqual(['member', 'friend_host', 'reviewer', 'owner'])
    expect(isAdminRole('owner')).toBe(true)
    expect(isAdminRole('reviewer')).toBe(true)
    expect(isAdminRole('member')).toBe(false)
    expect(isAdminRole('friend_host')).toBe(false)
  })

  it('keeps hidden moderation content out of public surfaces', () => {
    expect(isModerationVisible({})).toBe(true)
    expect(isModerationVisible({ hidden: false })).toBe(true)
    expect(isModerationVisible({ hidden: true })).toBe(false)
  })

  it('does not expose admin routes in the user workspace shell', () => {
    expect(workspaceRoutes).toEqual(['/app', '/profile', '/host'])
    expect(workspaceRoutes).not.toContain('/admin')
  })
})
