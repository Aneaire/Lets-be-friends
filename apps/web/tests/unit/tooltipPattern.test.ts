import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

describe('shared tooltip pattern', () => {
  it('renders the chip copy from the data-tooltip attribute', () => {
    const block = styles.match(/\[data-tooltip\]::after\s*\{[^}]*\}/s)?.[0] ?? ''

    expect(block).toContain('content: attr(data-tooltip);')
    expect(block).toContain('background: var(--surface);')
    expect(block).toContain('border: 1px solid var(--border);')
    expect(block).toContain('box-shadow: var(--shadow-popover-subtle);')
    expect(block).toContain('transition: opacity 120ms ease, translate 120ms ease;')
    expect(block).toContain('text-transform: uppercase;')
  })

  it('keeps the host free to set its own position', () => {
    expect(styles).toMatch(/:where\(\[data-tooltip\]\)\s*\{\s*position:\s*relative;/)
  })

  it('offers a below-right placement modifier for the verified badge', () => {
    expect(styles).toMatch(/\[data-tooltip-position="below-right"\]::after\s*\{[^}]*right:\s*-0\.35rem;/s)
  })

  it('no longer hardcodes the verified badge copy in the badge rule', () => {
    expect(styles).not.toMatch(/\.account-avatar-badge::after/)
    expect(styles).not.toContain('content: "Verified"')
  })
})
