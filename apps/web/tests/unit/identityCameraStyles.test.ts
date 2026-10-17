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

describe('identity camera toolbar styles', () => {
  it('centers the shutter without creating an implicit column at narrow widths', () => {
    const desktopShutterIndex = styles.indexOf('.identity-camera-shutter {')
    expect(desktopShutterIndex).toBeGreaterThan(-1)
    expect(blockAt(styles, desktopShutterIndex)).toMatch(/grid-column:\s*2;/)

    const narrowMediaIndex = styles.indexOf('@media (max-width: 600px)')
    expect(narrowMediaIndex).toBeGreaterThan(-1)

    const narrowStyles = blockAt(styles, narrowMediaIndex)
    expect(narrowStyles).toMatch(/\.identity-camera-toolbar\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*justify-items:\s*center;/s)
    expect(narrowStyles).toMatch(/\.identity-camera-shutter\s*\{[^}]*grid-column:\s*1;[^}]*justify-self:\s*center;/s)
  })

  it('does not restore the removed camera privacy note', () => {
    expect(styles).not.toContain('.identity-camera-privacy-note')
  })
})
