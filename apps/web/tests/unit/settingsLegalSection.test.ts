import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const settings = readFileSync(fileURLToPath(new URL('../../src/routes/settings.tsx', import.meta.url)), 'utf8')

describe('settings legal section', () => {
  it('lists both legal documents from the shared policy catalog', () => {
    expect(settings).toContain('legal-heading')
    expect(settings).toContain('policyDocuments.map')
    expect(settings).toContain('document.path')
    expect(settings).toContain('document.title')
    expect(settings).toContain('Terms and Conditions')
    expect(settings).toContain('Privacy Policy')
  })
})
