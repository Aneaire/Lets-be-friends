import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

describe('booking detail dialog styles', () => {
  it('removes the avatar fill only inside the booking detail dialog', () => {
    expect(styles).toMatch(/\.booking-detail-dialog-body \.avatar\s*\{\s*background:\s*transparent;\s*\}/)
  })

  it('keeps the global avatar background outside the booking detail dialog', () => {
    expect(styles).toMatch(/^\.avatar\s*\{[^}]*background:\s*color-mix\(in oklch, var\(--text\) 8%, transparent\);/ms)
  })
})
