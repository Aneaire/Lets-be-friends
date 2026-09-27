import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8')

describe('shared post card styles', () => {
  it('defines the common card surface on the shared ds-post-card selector', () => {
    expect(styles).toMatch(
      /\.ds-post-card \{[^}]*border: 1px solid var\(--border\);[^}]*border-radius: 12px;[^}]*background: var\(--surface\);/s,
    )
  })

  it('keeps the feed override to its page layout instead of redefining the card', () => {
    expect(styles).toMatch(
      /\.web-app-shell \.social-feed \.ds-post-card \{\s*border-radius: 0;\s*\}/,
    )
    const feedOverride = /\.web-app-shell \.social-feed \.ds-post-card \{([^}]*)\}/.exec(styles)
    expect(feedOverride?.[1]).not.toContain('border:')
    expect(feedOverride?.[1]).not.toContain('background:')
  })

  it('removes the context-specific profile post body and media selectors', () => {
    expect(styles).not.toContain('.profile-post-body')
    expect(styles).not.toContain('.profile-post-media')
    expect(styles).not.toContain('.social-post-copy')
  })
})

describe('post video open control styles', () => {
  it('keeps the expand control visually hidden until keyboard focus above the full-width scrub bar', () => {
    expect(styles).toMatch(/\.social-video-button\.social-post-video-open \{[^}]*clip: rect\(0 0 0 0\);/s)
    expect(styles).toMatch(/\.social-video-button\.social-post-video-open:focus-visible \{[^}]*background: oklch\(0% 0 0 \/ 72%\);/s)
    expect(styles).toMatch(/\.social-video-controls \{[^}]*z-index: 2;/s)
    expect(styles).toMatch(/\.social-video-scrub \{[^}]*width: calc\(100% \+ 1\.25rem\);/s)
  })
})
