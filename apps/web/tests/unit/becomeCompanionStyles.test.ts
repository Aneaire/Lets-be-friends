import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')
const route = readFileSync(fileURLToPath(new URL('../../src/routes/become-companion.tsx', import.meta.url)), 'utf8')
const fields = readFileSync(fileURLToPath(new URL('../../src/features/companion-application/CompanionProfileFields.tsx', import.meta.url)), 'utf8')

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
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.companion-editor-step \.label-aux\s*\{\s*display:\s*block;[\s\S]*margin-top:\s*0\.15rem;/s)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.companion-editor-actions\s*\{\s*position:\s*static;\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(5\.5rem, auto\) minmax\(0, 1fr\);/s)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.companion-editor-actions > :only-child\s*\{[\s\S]*grid-column:\s*1 \/ -1;[\s\S]*margin-left:\s*0;/s)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.companion-editor-aside\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/s)
    expect(styles).not.toMatch(/@media \(max-width: 680px\)[\s\S]*\.companion-editor-actions\s*\{[^}]*position:\s*sticky;/s)
  })

  it('renders the shared Companion profile fields in a single section', () => {
    expect(route).toContain('CompanionProfileFields')
    expect(route).toContain('companion-editor-actions')
    expect(route).not.toContain(') : <span />}')
    expect(route).not.toContain('companionEditorSteps')
  })

  it('identifies the public profile description as the bio field', () => {
    expect(fields).toContain('Tell me about yourself (Bio)')
    expect(fields).toContain('What work or skills could you share?')
  })

  it('replaces the saved form with a clear saved state and identity actions', () => {
    expect(route).toContain('Your Companion profile is saved')
    expect(route).toContain('hidden from discovery until your identity check is approved')
    expect(route).toContain('Identity and safety review is the only review step')
    expect(route).toContain('View verification status')
    expect(route).toContain('to="/get-verified"')
    expect(route).toContain('to="/"')
    expect(route).toContain('Go to home')
    expect(route).toContain('isSignedIn && !submitted')
    expect(route).toContain('onSubmitted()')
    expect(route).not.toContain('back in review')
    expect(route).not.toContain('Verify your identity next')
    expect(route).not.toContain('Verify my identity')
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

  it('keeps the editor open for saved profiles without a settings lock', () => {
    expect(route).toContain('canOpenCompanionProfile')
    expect(route).toContain('isSignedIn && !submitted && companionUnlocked')
    expect(route).toContain('Companion profile saved')
    expect(route).toContain('Identity and safety review')
    expect(route).toContain('Visible in discovery')
    expect(route).not.toContain('companionProfileEditorLocked')
    expect(route).not.toContain('Your Companion profile is locked')
    expect(route).not.toContain('Manage in settings')
    expect(route).not.toContain('validateSearch')
    expect(route).not.toContain('search.edit')
    expect(route).not.toContain('edit: true')
  })

  it('covers legacy review rows without presenting them as the expected path', () => {
    expect(route).toContain('previous review step')
    expect(route).not.toContain('Your profile is with the review team')
    expect(route).not.toContain('Companion profile review')
  })

  it('marks the locked card with a neutral identity icon', () => {
    expect(route).toContain("from 'lucide-react'")
    expect(route).toContain('<div className="companion-submission-mark" aria-hidden="true"><ShieldCheck')
  })
})
