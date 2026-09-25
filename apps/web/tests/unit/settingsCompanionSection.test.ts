import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const settings = readFileSync(fileURLToPath(new URL('../../src/routes/settings.tsx', import.meta.url)), 'utf8')

describe('settings Companion section', () => {
  it('moves rate and profile editing into settings', () => {
    expect(settings).toContain('companion-heading')
    expect(settings).toContain('Verified profiles are locked. Change your price and profile details here.')
    expect(settings).toContain('Hourly rate')
    expect(settings).toContain('Companion profile details')
    expect(settings).toContain('Verification status')
  })

  it('opens the locked editor in explicit edit mode', () => {
    expect(settings).toContain('to="/become-companion"')
    expect(settings).toContain('search={{ edit: true }}')
  })

  it('keeps the get started path for members without a profile', () => {
    expect(settings).toContain('Become a Companion')
    expect(settings).toContain('to="/companion"')
  })
})
