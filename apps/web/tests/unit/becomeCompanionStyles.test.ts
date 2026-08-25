import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

describe('Become Companion layout styles', () => {
  it('styles the signed-out invitation and signed-in editor', () => {
    const requiredSelectors = [
      '.companion-hero',
      '.companion-definition',
      '.companion-benefit-grid',
      '.companion-ideas',
      '.drawer-companion',
      '.companion-editor-progress',
      '.companion-mode-options',
      '.companion-profile-preview',
      '.companion-review-steps',
    ]

    for (const selector of requiredSelectors) {
      expect(styles).toContain(selector)
    }
  })

  it('keeps inactive editor steps hidden and provides a mobile layout', () => {
    expect(styles).toMatch(/\.companion-editor-step\[hidden\]\s*\{\s*display:\s*none;/s)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.companion-mode-options\s*\{\s*grid-template-columns:\s*1fr;/s)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.companion-mobile-preview\s*\{\s*display:\s*block;/s)
  })
})
