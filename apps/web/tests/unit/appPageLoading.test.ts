import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const route = readFileSync(fileURLToPath(new URL('../../src/routes/app.tsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

describe('Member bookings page loading state', () => {
  it('renders the shared page skeleton instead of the old inline loading copy', () => {
    expect(route).toContain("import { AppPageSkeleton } from '../features/booking/AppPageSkeleton'")
    expect(route).toContain('<AppPageSkeleton />')
    expect(route).not.toContain('Loading your profile')
  })

  it('waits for the viewer and dependent core data before rendering live counts', () => {
    expect(route).toContain('const coreDataReady = viewer === undefined')
    expect(route).toContain('viewer === null')
    expect(route).toContain('latestMemberVerification !== undefined')
    expect(route).toContain('bookings !== undefined')
    expect(route).toContain('memberFinance !== undefined')
    expect(route).toContain('if (!coreDataReady)')
  })

  it('ships scoped skeleton styles that honor reduced motion', () => {
    expect(styles).toContain('.app-page-skeleton')
    expect(styles).toContain('.app-page-skeleton-action')
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.app-page-skeleton \.skeleton\s*\{\s*animation:\s*none;/s)
  })
})
