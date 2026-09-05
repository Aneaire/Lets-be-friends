import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

describe('account navigation styles', () => {
  it('uses restrained shadows for the desktop menu and mobile sheet', () => {
    expect(styles).toMatch(/\.web-app-shell \.account-menu-panel\s*\{[\s\S]*?box-shadow:\s*var\(--shadow-popover-subtle\);/)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.web-app-shell \.account-menu-panel\s*\{[\s\S]*?box-shadow:\s*0 -0\.25rem 0\.75rem color-mix\(in oklch, var\(--text\) 12%, transparent\);/)
  })
})
