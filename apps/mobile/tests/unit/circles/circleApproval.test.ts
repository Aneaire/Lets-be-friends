import {
  canAccessCirclePendingQueue,
  circleComposerApprovalNotice,
  circlePostApprovalLabel,
  circleWorkspaceTabs,
  CIRCLE_APPROVAL_NOTICE,
  CIRCLE_APPROVAL_SUBMITTED_NOTICE,
} from '@/features/circles/circlePresentation'

describe('mobile Circle approval workflow presentation', () => {
  it('gives hosts and moderators a Pending tab while keeping Manage host-only', () => {
    expect(circleWorkspaceTabs({ canModerate: true, isCanonicalHost: true })).toEqual([
      'discussions',
      'about',
      'members',
      'pending',
      'removed',
      'manage',
    ])
    expect(circleWorkspaceTabs({ canModerate: true, isCanonicalHost: false })).toEqual([
      'discussions',
      'about',
      'members',
      'pending',
      'removed',
    ])
    expect(circleWorkspaceTabs({ canModerate: false, isCanonicalHost: false })).toEqual([
      'discussions',
      'about',
      'members',
    ])
  })

  it('never grants the pending queue to members or archived Circles', () => {
    expect(canAccessCirclePendingQueue({ canModerate: true, circleState: 'active' })).toBe(true)
    expect(canAccessCirclePendingQueue({ canModerate: false, circleState: 'active' })).toBe(false)
    expect(canAccessCirclePendingQueue({ canModerate: true, circleState: 'archived' })).toBe(false)
    expect(canAccessCirclePendingQueue({ canModerate: true, circleState: 'suspended' })).toBe(false)
    expect(canAccessCirclePendingQueue({})).toBe(false)
  })

  it('labels pending and rejected posts for their authors', () => {
    expect(circlePostApprovalLabel('pending')).toBe('Waiting for leader approval')
    expect(circlePostApprovalLabel('rejected')).toBe('Not approved')
    expect(circlePostApprovalLabel('approved')).toBeNull()
    expect(circlePostApprovalLabel(null)).toBeNull()
    expect(circlePostApprovalLabel(undefined)).toBeNull()
  })

  it('shows the approval notice only to non-moderators in approval Circles', () => {
    expect(circleComposerApprovalNotice({ postApproval: 'approval_required', canModerate: false })).toBe(true)
    expect(circleComposerApprovalNotice({ postApproval: 'approval_required', canModerate: true })).toBe(false)
    expect(circleComposerApprovalNotice({ postApproval: 'off', canModerate: false })).toBe(false)
    expect(circleComposerApprovalNotice({})).toBe(false)
  })

  it('keeps approval copy free of em dashes', () => {
    for (const copy of [CIRCLE_APPROVAL_NOTICE, CIRCLE_APPROVAL_SUBMITTED_NOTICE]) {
      expect(copy).not.toContain('—')
      expect(copy.length).toBeGreaterThan(0)
    }
  })
})
