import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const settings = readFileSync(fileURLToPath(new URL('../../src/routes/settings.tsx', import.meta.url)), 'utf8')

describe('settings Companion section', () => {
  it('describes the live profile model with identity as the only review', () => {
    expect(settings).toContain('companion-heading')
    expect(settings).toContain('Your profile saves live. Identity verification is the only review, and your profile appears in discovery once identity is approved.')
    expect(settings).toContain('Hourly rate')
    expect(settings).toContain('Companion profile details')
    expect(settings).toContain('Verification status')
    expect(settings).toContain('Review your identity verification. It is the only review step.')
    expect(settings).not.toContain('Verified profiles are locked')
    expect(settings).not.toContain('track its review')
  })

  it('links directly to the always-open profile editor', () => {
    expect(settings).toContain('to="/become-companion"')
    expect(settings).not.toContain('edit: true')
  })

  it('keeps the get started path for members without a profile', () => {
    expect(settings).toContain('Start earning as a Companion')
    expect(settings).toContain('to="/become-companion"')
  })
})
