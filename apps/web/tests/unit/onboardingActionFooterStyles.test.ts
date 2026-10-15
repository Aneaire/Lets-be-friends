import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

// These rules encode non-obvious cascade constraints, so a future edit that looks
// harmless can silently stop applying. Each assertion names the trap.
describe('onboarding action footer styles', () => {
  it('keeps the action pair on one right-aligned row', () => {
    expect(styles).toMatch(/\.onboarding-actions-row\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*flex-end;/s)
  })

  it('lets the pair shrink and wrap instead of overflowing the row', () => {
    expect(styles).toMatch(/\.onboarding-actions-row\s*>\s*\.btn\s*\{[\s\S]*?min-width:\s*0;/s)
    expect(styles).toMatch(/\.onboarding-actions-row\s+\.btn\s*>\s*span\s*\{[\s\S]*?white-space:\s*normal;/s)
  })

  it('sizes the icon-only back control from the shared touch token', () => {
    // Two classes are required: a single class loses the padding fight against
    // the .btn rule in compact.css, which loads after this file.
    expect(styles).toMatch(/\.onboarding-actions-row\s+\.onboarding-back\s*\{[\s\S]*?width:\s*var\(--density-touch\);[\s\S]*?padding-inline:\s*0;/s)
  })

  it('never stretches the back control at phone widths', () => {
    // The grow rule must exclude the back control, or it stretches to fill the row.
    expect(styles).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.onboarding-actions-row\s*>\s*\.btn:not\(\.onboarding-back\)\s*\{\s*flex:\s*1 1 auto;\s*\}/s)
  })

  it('carries the skip font size on the wrapper, never on the button', () => {
    // An unlayered `button { font: inherit }` rule outranks every layered rule, so
    // a font-size set on .onboarding-skip itself would be silently ignored.
    expect(styles).toMatch(/\.onboarding-skip-row\s*\{[\s\S]*?font-size:\s*0\.8125rem;/s)
    expect(styles).not.toMatch(/\.onboarding-skip\s*\{[^}]*font-size:/s)
  })
})
