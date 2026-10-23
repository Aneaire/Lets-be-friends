import { describe, expect, it } from 'vitest'
import {
  identityRejectionGuidance,
  identityRejectionReasonGuidance,
  identityRejectionReasons,
  isIdentityRejectionReason,
} from '../../src/identity'

describe('member-safe identity rejection reasons', () => {
  it('keeps one code and one guidance entry per reason', () => {
    expect(identityRejectionReasons.length).toBeGreaterThan(0)
    for (const reason of identityRejectionReasons) {
      expect(isIdentityRejectionReason(reason.code)).toBe(true)
      expect(identityRejectionGuidance[reason.code].trim().length).toBeGreaterThan(0)
      expect(identityRejectionReasonGuidance(reason.code)).toBe(identityRejectionGuidance[reason.code])
    }
  })

  it('rejects unknown, missing, and malformed reason codes', () => {
    expect(isIdentityRejectionReason('unknown')).toBe(false)
    expect(isIdentityRejectionReason('')).toBe(false)
    expect(isIdentityRejectionReason(undefined)).toBe(false)
    expect(isIdentityRejectionReason(null)).toBe(false)
    expect(identityRejectionReasonGuidance('unknown')).toContain('did not approve this identity attempt')
    expect(identityRejectionReasonGuidance(undefined)).toContain('did not approve this identity attempt')
  })

  it('does not include user-facing em dashes', () => {
    for (const reason of identityRejectionReasons) {
      expect(reason.label).not.toContain('—')
      expect(identityRejectionGuidance[reason.code]).not.toContain('—')
    }
  })
})
