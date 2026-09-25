import { describe, expect, it } from 'vitest'
import { companionProfileEditorLocked } from '../../src/lib/memberVerification'

describe('companion profile editor lock', () => {
  it('locks the public editor once the profile is approved', () => {
    expect(companionProfileEditorLocked('approved', false)).toBe(true)
  })

  it('unlocks the approved profile only through the explicit edit mode', () => {
    expect(companionProfileEditorLocked('approved', true)).toBe(false)
  })

  it('keeps unfinished profiles editable', () => {
    for (const status of [undefined, 'pending_review', 'rejected', 'suspended']) {
      expect(companionProfileEditorLocked(status, false)).toBe(false)
    }
  })
})
