import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')
const route = readFileSync(fileURLToPath(new URL('../../src/routes/companion-profile.tsx', import.meta.url)), 'utf8')

describe('Companion profile layout styles', () => {
  it('styles the class names rendered by the public Companion profile', () => {
    const requiredSelectors = [
      '.companion-profile-page',
      '.companion-profile-hero',
      '.companion-profile-overview',
      '.companion-profile-identity',
      '.companion-profile-name',
      '.companion-profile-decision',
      '.companion-profile-rate-label',
      '.companion-profile-actions',
      '.companion-profile-fit-grid',
    ]

    for (const selector of requiredSelectors) {
      expect(styles).toContain(selector)
    }

    expect(styles).toMatch(/\.companion-profile-identity \.profile-photo-lg\s*\{[^}]*width:\s*6rem;[^}]*height:\s*6rem;/s)
    expect(styles).toMatch(/\.companion-profile-name\s*\{[^}]*font-size:\s*clamp\(1\.5rem,[^}]*1\.75rem\);/s)
    expect(styles).toMatch(/\.companion-profile-intro\s*\{[^}]*font-size:\s*0\.9375rem;[^}]*font-weight:\s*650;/s)
    expect(styles).toMatch(/\.companion-profile-bio\s*\{[^}]*font-size:\s*0\.875rem;[^}]*font-weight:\s*400;/s)
    expect(styles).toMatch(/\.companion-profile-rate\s*\{[^}]*border-left:\s*3px solid var\(--accent-social\);/s)
    expect(styles).toMatch(/\.companion-profile-rate strong\s*\{[^}]*color:\s*var\(--accent-social\);/s)
    expect(route.indexOf('className="companion-profile-intro"')).toBeLessThan(route.indexOf('className="companion-profile-bio"'))
    expect(styles).not.toContain('.host-profile-')
  })
})
