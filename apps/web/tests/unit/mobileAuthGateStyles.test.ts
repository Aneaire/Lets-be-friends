import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8')

describe('mobile authentication gate styles', () => {
  it('keeps the gate hidden on larger screens', () => {
    expect(styles).toMatch(/\.mobile-auth-gate\s*\{\s*display:\s*none;/)
  })

  it('shows the sign-in gate and hides content only when the gate is blocking', () => {
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.mobile-auth-gate\s*\{[\s\S]*display:\s*grid;/)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.mobile-auth-gate-root\[data-gate="blocking"\] \.mobile-auth-guarded-content\s*\{\s*display:\s*none;/)
  })

  it('scopes the small-screen brand text hide to the signed-in header', () => {
    const hideRules = styles.match(/[^}{]*\.web-app-shell[^{}]*\.brand-link[^{}]*\{[^}]*clip:\s*rect\(0, 0, 0, 0\)[^}]*\}/g) ?? []
    expect(hideRules.length).toBeGreaterThan(0)
    for (const rule of hideRules) {
      expect(rule).toContain('[data-member]')
    }
  })
})
