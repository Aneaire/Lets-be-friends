import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8')

describe('mobile authentication gate styles', () => {
  it('keeps the gate hidden on larger screens', () => {
    expect(styles).toMatch(/\.mobile-auth-gate\s*\{\s*display:\s*none;/)
  })

  it('shows only the sign-in gate at phone widths', () => {
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.mobile-auth-gate\s*\{[\s\S]*display:\s*grid;/)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.mobile-auth-guarded-content\s*\{\s*display:\s*none;/)
  })
})
