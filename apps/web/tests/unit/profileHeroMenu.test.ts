import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')
const route = readFileSync(fileURLToPath(new URL('../../src/routes/profile.tsx', import.meta.url)), 'utf8')

describe('profile hero menu', () => {
  it('moves the three profile actions behind a top-corner menu', () => {
    expect(route).toContain('<ActionMenu label="Profile actions" panelLabel="Profile actions" items={profileActions} />')
    expect(route).toContain("label: 'Edit profile',")
    expect(route).toContain("label: 'Your bookings',")
    expect(route).toContain("label: application ? 'Edit Companion profile' : 'Become a Companion',")
    expect(route).toContain('onSelect: () => setEditOpen(true),')
    expect(route).toContain("onSelect: () => void navigate({ to: '/app', search: {} }),")
    expect(route).toContain("onSelect: () => void navigate({ to: '/become-companion' }),")
  })

  it('keeps the accent semantics: self for profile work, social for bookings', () => {
    const actionsStart = route.indexOf('const profileActions: ActionMenuItem[] = [')
    const actionsEnd = route.indexOf('  ]', actionsStart)
    const actions = route.slice(actionsStart, actionsEnd)

    expect(actions).toMatch(/label: 'Edit profile',[\s\S]*?tone: 'self',/)
    expect(actions).toMatch(/label: 'Your bookings',[\s\S]*?tone: 'social',/)
    expect(actions).toMatch(/label: application \? 'Edit Companion profile' : 'Become a Companion',[\s\S]*?tone: 'self',/)
  })

  it('removes the button row that used to hold them', () => {
    expect(route).not.toContain('profile-hero-actions')
    expect(styles).not.toContain('.profile-hero-actions')
    expect(route).not.toContain('btn btn-self btn-sm" onClick={() => setEditOpen(true)}')
  })

  it('anchors the menu in the hero top corner without adding a row', () => {
    expect(styles).toMatch(/\.profile-hero-menu \{\s*position: absolute;\s*top: 0\.65rem;\s*right: 0\.65rem;\s*\}/)
    expect(styles).toMatch(/\.profile-hero-panel \{\s*position: relative;\s*overflow: hidden;/)
  })

  it('lets an open menu leave the rounded panel instead of clipping it', () => {
    expect(styles).toMatch(/\.profile-hero-panel:has\(\.ds-action-menu-panel\) \{\s*overflow: visible;\s*\}/)
  })

  it('drops the third hero grid column that held the buttons', () => {
    const baseRule = styles.match(/\.profile-hero-body \{\s*display: grid;[\s\S]*?\n\}/)?.[0] ?? ''
    const desktopRule = styles.match(/\.profile-hero-body \{\s*grid-template-columns: auto minmax\(0, 1fr\);\s*align-items: center;[\s\S]*?\n  \}/)?.[0] ?? ''

    expect(baseRule).toContain('grid-template-columns: auto minmax(0, 1fr);')
    expect(baseRule).not.toContain('minmax(0, 1fr) auto;')
    expect(desktopRule).toContain('grid-template-columns: auto minmax(0, 1fr);')
  })
})
