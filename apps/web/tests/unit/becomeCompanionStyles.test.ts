import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')
const route = readFileSync(fileURLToPath(new URL('../../src/routes/become-companion.tsx', import.meta.url)), 'utf8')

describe('Become Companion layout styles', () => {
  it('styles the signed-out invitation and signed-in editor', () => {
    const requiredSelectors = [
      '.companion-hero',
      '.companion-definition',
      '.companion-benefit-grid',
      '.companion-ideas',
      '.drawer-companion',
      '.companion-editor-progress',
      '.companion-mode-options',
      '.companion-profile-preview',
      '.companion-review-steps',
      '.companion-submission-card',
      '.companion-submission-actions',
    ]

    for (const selector of requiredSelectors) {
      expect(styles).toContain(selector)
    }
  })

  it('keeps inactive editor steps hidden and provides a mobile layout', () => {
    expect(styles).toMatch(/\.companion-editor-step\[hidden\]\s*\{\s*display:\s*none;/s)
    expect(styles).toMatch(/\.companion-editor-step \.label\s*\{[\s\S]*font-size:\s*0\.9375rem;[\s\S]*font-weight:\s*680;/s)
    expect(styles).toMatch(/\.companion-editor-step \.label-aux\s*\{[\s\S]*font-size:\s*0\.8125rem;/s)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.companion-mode-options\s*\{\s*grid-template-columns:\s*1fr;/s)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.companion-editor-aside\s*\{\s*display:\s*block;/s)
  })

  it('identifies the public profile description as the bio field', () => {
    expect(route).toContain('Tell me about yourself (Bio)')
  })

  it('replaces the submitted form with clear review and identity actions', () => {
    expect(route).toContain('Thank you for applying to be a Companion')
    expect(route).toContain('sent to our review team')
    expect(route).toContain('both reviews are now in progress')
    expect(route).toContain('Your application will be reviewed')
    expect(route).toContain('View verification status')
    expect(route).toContain('to="/get-verified"')
    expect(route).toContain('to="/"')
    expect(route).toContain('Go to home')
    expect(route).toContain('isSignedIn && !submitted')
    expect(route).toContain('onSubmitted()')
    expect(route).not.toContain('Verify your identity next')
    expect(route).not.toContain('Verify my identity')
    expect(route).not.toContain('Profile sent for review. Identity and the Companion profile are reviewed separately.')
  })

  it('styles the identity locked card', () => {
    expect(styles).toContain('.companion-locked-card')
    expect(styles).toContain('.companion-locked-actions')
  })

  it('locks direct access until identity is submitted for safety review', () => {
    expect(route).toContain('canOpenCompanionProfile')
    expect(route).toContain('companion-locked-card')
    expect(route).toContain('Complete your identity check first')
    expect(route).toContain('Identity is step 1 and your Companion profile is step 2')
    expect(route).toContain('to="/verify-identity"')
    expect(route).toContain('companion_application')
    expect(route).toContain('Check identity status')
    expect(route).toContain('local draft')
    expect(route).toContain('readCompanionApplicationDraft')
  })

  it('gates the signed-in editor intro on identity eligibility', () => {
    expect(route).toContain('Open profile editor')
    expect(route).toContain('isSignedIn && !submitted && companionUnlocked')
    expect(route).toContain("useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')")
    expect(route).toMatch(/const companionUnlocked = viewer[\s\S]*canOpenCompanionProfile\(viewer\.identityEligible/)
  })

  it('marks the locked card with a neutral identity icon', () => {
    expect(route).toContain("from 'lucide-react'")
    expect(route).toContain('<div className="companion-submission-mark" aria-hidden="true"><ShieldCheck')
  })
})
