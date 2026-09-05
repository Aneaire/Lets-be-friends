import { describe, expect, it } from 'vitest'
import { companionSetupState, verificationNudge } from '../../src/lib/verificationNudge'

describe('verification nudge', () => {
  it('pushes identity verification before anything else', () => {
    expect(verificationNudge({ state: 'not_started' }, 'approved')).toEqual({ highlight: true, label: 'Verify identity' })
    expect(verificationNudge({ state: 'admin_pending' }, 'none')).toEqual({ highlight: true, label: 'Verify identity' })
    expect(verificationNudge(null, 'approved')).toEqual({ highlight: true, label: 'Verify identity' })
    expect(verificationNudge(undefined, undefined)).toEqual({ highlight: true, label: 'Verify identity' })
  })

  it('pushes the Companion profile as the earnings unlock once identity is approved', () => {
    expect(verificationNudge({ state: 'approved' }, 'none')).toEqual({ highlight: true, label: 'Unlock earnings' })
    expect(verificationNudge({ state: 'approved' }, 'draft')).toEqual({ highlight: true, label: 'Unlock earnings' })
    expect(verificationNudge({ state: 'approved' }, null)).toEqual({ highlight: true, label: 'Unlock earnings' })
  })

  it('stays quiet once identity is approved and the Companion profile is past setup', () => {
    for (const companion of ['pending_review', 'approved', 'rejected', 'suspended'] as const) {
      expect(verificationNudge({ state: 'approved' }, companion)).toEqual({ highlight: false, label: 'Verified' })
    }
  })

  it('normalizes companion statuses and treats unknown values as not started', () => {
    expect(companionSetupState('approved')).toBe('approved')
    expect(companionSetupState('pending_review')).toBe('pending_review')
    expect(companionSetupState(null)).toBe('none')
    expect(companionSetupState(undefined)).toBe('none')
    expect(companionSetupState('archived')).toBe('none')
  })
})
