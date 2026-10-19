import { describe, expect, it } from 'vitest'
import { companionSetupState, fullyVerifiedAccount, verificationNudge } from '../../src/lib/verificationNudge'

describe('verification nudge', () => {
  it('pushes identity verification before anything else since it is the only review', () => {
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

  it('stays quiet once identity is approved and the Companion profile is saved', () => {
    // Profiles save live, so legacy review statuses never re-trigger the nudge.
    for (const companion of ['pending_review', 'approved', 'rejected', 'suspended'] as const) {
      expect(verificationNudge({ state: 'approved' }, companion)).toEqual({ highlight: false, label: 'Verified' })
    }
  })

  it('counts a member as fully verified only with the approved identity check and a saved Companion profile', () => {
    expect(fullyVerifiedAccount({ state: 'approved' }, 'approved')).toBe(true)
    // The identity check is the only review, so a saved live profile completes it.
    expect(fullyVerifiedAccount({ state: 'approved' }, 'pending_review')).toBe(true)
    // Every other identity state still needs work before the badge shows.
    for (const identity of ['not_started', 'action_required', 'provider_processing', 'admin_pending', 'provider_declined', 'admin_rejected', 'expired'] as const) {
      expect(fullyVerifiedAccount({ state: identity }, 'approved')).toBe(false)
    }
    expect(fullyVerifiedAccount({ state: 'approved' }, 'none')).toBe(false)
    expect(fullyVerifiedAccount({ state: 'approved' }, 'draft')).toBe(false)
    expect(fullyVerifiedAccount(null, 'approved')).toBe(false)
    expect(fullyVerifiedAccount(undefined, undefined)).toBe(false)
  })

  it('normalizes companion statuses and treats unknown values as not started', () => {
    expect(companionSetupState('approved')).toBe('approved')
    expect(companionSetupState('pending_review')).toBe('pending_review')
    expect(companionSetupState(null)).toBe('none')
    expect(companionSetupState(undefined)).toBe('none')
    expect(companionSetupState('archived')).toBe('none')
  })
})
