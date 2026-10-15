import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

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

describe('home hero invitation prompt styles', () => {
  it('keeps the prompt chips as a wrapping row on desktop widths', () => {
    expect(styles).toMatch(/\.invitation-prompt-list \{\s*display: flex;\s*flex-wrap: wrap;/)
  })

  it('hides the prompt chips on mobile widths instead of stacking them', () => {
    const promptListIndex = styles.indexOf('.invitation-prompt-list')
    const mobileMediaIndex = styles.indexOf('@media (max-width: 700px)', promptListIndex)
    expect(promptListIndex).toBeGreaterThan(-1)
    expect(mobileMediaIndex).toBeGreaterThan(promptListIndex)

    const mobileBlock = blockAt(styles, mobileMediaIndex)
    expect(mobileBlock).toMatch(/\.invitation-prompt-list \{\s*display: none;\s*\}/)
    expect(mobileBlock).not.toContain('.invitation-prompt {')
  })
})
