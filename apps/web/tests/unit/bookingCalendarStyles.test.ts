import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

describe('booking calendar indicator styles', () => {
  it('marks booking count indicators with the semantic success token', () => {
    expect(styles).toMatch(/\.booking-calendar-count\s*\{[^}]*background:\s*var\(--success\);/s)
  })

  it('does not color the booking count indicator with the social accent', () => {
    const block = styles.match(/\.booking-calendar-count\s*\{[^}]*\}/s)?.[0] ?? ''
    expect(block).not.toContain('--accent-social')
  })
})
