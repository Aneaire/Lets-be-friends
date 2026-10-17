import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

describe('profile detail card styles', () => {
  it('lays the Companion summary out in two columns and stacks it on narrow screens', () => {
    expect(styles).toMatch(/\.profile-companion-body \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1\.35fr\) minmax\(0, 1fr\);/)

    const stackIndex = styles.indexOf('.profile-companion-body {\n    grid-template-columns: 1fr;')
    expect(stackIndex).toBeGreaterThan(-1)

    const stackBlock = styles.slice(styles.lastIndexOf('@media (max-width: 900px)', stackIndex), stackIndex + 300)
    expect(stackBlock).toContain('.profile-companion-body > div + div {')
    expect(stackBlock).toContain('border-top: 1px solid var(--rule);')
  })

  it('keeps the Companion chip lists identical to the About card chips', () => {
    expect(styles).toMatch(/\.profile-about-card \.profile-about-interests,\s*\.profile-companion-chips \{/)
    expect(styles).toMatch(/\.profile-about-card \.profile-about-interests li,\s*\.profile-companion-chips li \{/)
  })

  it('keeps the Companion status pill on one line beside the heading', () => {
    expect(styles).toMatch(/\.profile-companion-card \.status-pill \{\s*white-space: nowrap;\s*\}/)
  })

  it('wraps long Companion invitation text instead of overflowing the card', () => {
    expect(styles).toMatch(/\.profile-companion-invitation \{[\s\S]*?white-space: pre-wrap;\s*overflow-wrap: break-word;/)
  })
})
