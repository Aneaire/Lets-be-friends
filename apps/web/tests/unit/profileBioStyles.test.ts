import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')
const route = readFileSync(fileURLToPath(new URL('../../src/routes/profile.tsx', import.meta.url)), 'utf8')

function blockAt(source: string, startIndex: number) {
  const open = source.indexOf('{', startIndex)
  let depth = 0

  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    else if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, index)
    }
  }

  throw new Error('Unbalanced CSS block')
}

describe('profile hero bio styles', () => {
  it('renders the bio with the class that owns its measure', () => {
    expect(route).toContain('className="text-body muted profile-hero-bio"')
  })

  it('lets the hero own the stack rhythm instead of Tailwind spacing utilities', () => {
    expect(route).toContain('<p className="text-meta">@{username}</p>')
    expect(route).not.toMatch(/className="text-body muted profile-hero-bio[^"]*mt-/)
  })

  it('resets the default h1 and paragraph margins inside the hero copy', () => {
    expect(styles).toMatch(/\.profile-hero-copy h1,\s*\.profile-hero-copy p \{\s*margin: 0;\s*\}/)
    expect(styles).toMatch(/\.profile-hero-copy > \.text-meta \{\s*margin-top: 0\.35rem;\s*\}/)
    expect(styles).toMatch(/\.profile-hero-copy > \.profile-hero-bio \{\s*margin-top: 0\.6rem;\s*\}/)
  })

  it('uses one gap for the stacked hero instead of the actions padding', () => {
    expect(styles).toMatch(/\.profile-hero-body \{\s*gap: 1rem;\s*\}/)
  })

  it('caps the bio measure and keeps the line breaks the member typed', () => {
    expect(styles).toMatch(/\.profile-hero-bio \{\s*max-width: 52ch;\s*line-height: 1\.6;\s*overflow-wrap: break-word;\s*white-space: pre-wrap;\s*\}/)
  })

  it('centers the bio under the centered mobile identity instead of running it edge to edge', () => {
    const baseIndex = styles.indexOf('\n.profile-hero-bio {')
    const mobileRuleIndex = styles.indexOf('\n    .profile-hero-bio {')
    expect(baseIndex).toBeGreaterThan(-1)
    expect(mobileRuleIndex).toBeGreaterThan(baseIndex)

    const mobileMediaIndex = styles.lastIndexOf('@media (max-width: 767px)', mobileRuleIndex)
    expect(mobileMediaIndex).toBeGreaterThan(baseIndex)

    const mobileBlock = blockAt(styles, mobileMediaIndex)
    expect(mobileBlock).toMatch(/\.profile-hero-bio \{\s*width: 100%;\s*max-width: 34ch;\s*margin-inline: auto;\s*text-align: center;/)
    expect(mobileBlock).toContain('text-wrap: pretty;')
  })

  it('does not force the mobile hero bio back to full width left alignment', () => {
    expect(styles).not.toContain('.profile-hero-copy .text-body')
  })
})
