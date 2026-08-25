import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

describe('Companion profile layout styles', () => {
  it('styles the class names rendered by the public Companion profile', () => {
    const requiredSelectors = [
      '.companion-profile-page',
      '.companion-profile-hero',
      '.companion-profile-overview',
      '.companion-profile-identity',
      '.companion-profile-decision',
      '.companion-profile-actions',
      '.companion-profile-fit-grid',
    ]

    for (const selector of requiredSelectors) {
      expect(styles).toContain(selector)
    }

    expect(styles).toMatch(/\.companion-profile-identity \.profile-photo-lg\s*\{[^}]*width:\s*6rem;[^}]*height:\s*6rem;/s)
    expect(styles).not.toContain('.host-profile-')
  })
})
