import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const route = readFileSync(fileURLToPath(new URL('../../src/routes/companion-profile.tsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

describe('Companion profile actions', () => {
  it('keeps secondary and safety actions in one overflow menu instead of a button row', () => {
    expect(route).toContain('<ProfileOptionsMenu')
    expect(route).toContain('className="companion-profile-overflow"')
    expect(route).not.toContain('btn btn-social-quiet btn-sm')
    expect(route).not.toContain('btn btn-danger btn-sm')
    expect(route).not.toContain("'Save profile'")
    expect(route).not.toContain('>Report<')
  })

  it('keeps the action rail to one column after the extra buttons move into the menu', () => {
    expect(styles).toMatch(/\.companion-profile-overflow\s*\{[^}]*margin-left:\s*auto;/s)
    expect(styles).toMatch(/\.companion-profile-actions\s*\{[^}]*grid-template-columns:\s*1fr;/s)
  })
})
