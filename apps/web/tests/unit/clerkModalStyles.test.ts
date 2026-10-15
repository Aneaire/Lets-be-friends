import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

// Clerk anchors its modal card to the top of the viewport. Each assertion below
// guards a constraint that makes the centring override actually apply, because
// the obvious version of each one fails silently.
describe('clerk modal positioning styles', () => {
  it('centres the card with auto vertical margins rather than align-items', () => {
    expect(styles).toMatch(/\.cl-modalBackdrop\s+\.cl-modalContent\s*\{\s*margin-block:\s*auto;\s*\}/)
    const backdropRule = styles.match(/\.cl-modalBackdrop\s*\{[^}]*\}/s)?.[0] ?? ''
    // align-items: center would clip the top of a form taller than the viewport.
    expect(backdropRule).not.toContain('align-items')
  })

  it('keeps a minimum clearance around the card', () => {
    expect(styles).toMatch(/\.cl-modalBackdrop\s*\{[^}]*padding-block:\s*1\.5rem;/s)
  })

  it('declares the overrides outside @layer so they outrank the styles Clerk injects', () => {
    // Anchor to a real at-rule at the start of a line so a comment mentioning
    // @layer cannot be mistaken for the layer boundary.
    const firstLayerIndex = styles.search(/^@layer\s+(base|components)/m)
    const overrideIndex = styles.indexOf('.cl-modalBackdrop .cl-modalContent')
    expect(firstLayerIndex).toBeGreaterThan(-1)
    expect(overrideIndex).toBeGreaterThan(-1)
    // Inside a layer, no amount of specificity would win against Clerk's unlayered CSS.
    expect(overrideIndex).toBeLessThan(firstLayerIndex)
  })

  it('targets the content through the backdrop so it beats the Clerk mobile override', () => {
    expect(styles).toMatch(/\.cl-modalBackdrop\s+\.cl-modalContent\s*\{/)
    // A bare single-class rule loses to Clerk's own `.cl-modalContent` media query.
    expect(styles).not.toMatch(/^\.cl-modalContent\s*\{/m)
  })
})
