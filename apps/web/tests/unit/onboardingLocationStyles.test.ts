import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

describe('onboarding location layout styles', () => {
  it('gives the onboarding map a taller frame than the generic preview', () => {
    expect(styles).toMatch(/\.onboarding-location-card\s+\.approx-location-map-frame\s*\{[\s\S]*?min-height:\s*20rem;/s)
  })

  it('keeps a single card by flattening the inner username and location sections', () => {
    expect(styles).toMatch(/\.onboarding-location-card\s*\{[\s\S]*?background:\s*transparent;/s)
    expect(styles).toMatch(/\.onboarding-location-card\s*\{[\s\S]*?border-top:\s*1px solid var\(--rule\);/s)
    expect(styles).toMatch(/\.onboarding-username-card\s*\{[\s\S]*?background:\s*transparent;/s)
  })

  it('keeps the map close to the device location button', () => {
    expect(styles).toMatch(/\.onboarding-location-card\s+\.approx-location-figure\s*\{\s*margin-top:\s*0\.25rem;/s)
  })

  it('trims nested side padding and keeps the map tall at phone widths', () => {
    expect(styles).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.onboarding-stage\s*\{[\s\S]*?padding:\s*1\.25rem 0\.75rem;/s)
    expect(styles).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.onboarding-location-card\s+\.approx-location-map-frame\s*\{[\s\S]*?min-height:\s*20rem;/s)
  })
})
