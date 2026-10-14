import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as memberVerification from '../../src/lib/memberVerification'
import { canOpenCompanionProfile } from '../../src/lib/memberVerification'

const route = readFileSync(fileURLToPath(new URL('../../src/routes/become-companion.tsx', import.meta.url)), 'utf8')

describe('companion profile editing', () => {
  it('no longer locks the editor for saved profiles', () => {
    expect('companionProfileEditorLocked' in memberVerification).toBe(false)
    expect(route).not.toContain('companionProfileEditorLocked')
    expect(route).not.toContain('Your Companion profile is locked')
  })

  it('opens the editor whenever the viewer is identity-eligible', () => {
    expect(canOpenCompanionProfile(true, null)).toBe(true)
    expect(canOpenCompanionProfile(false, null)).toBe(false)
    expect(route).toContain('isSignedIn && !submitted && companionUnlocked')
  })

  it('keeps the identity gate while profile status alone never locks', () => {
    expect(canOpenCompanionProfile(false, {
      adminStatus: 'pending',
      verificationSource: 'in_app',
      identityStage: 'ready_for_review',
      isCurrent: true,
      reason: 'member',
    })).toBe(true)
    expect(route).toContain('Complete your identity check first')
  })
})
