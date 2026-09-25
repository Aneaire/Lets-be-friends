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
  it('positions the semantic open control over the media and keeps controls stacked above it', () => {
    expect(styles).toMatch(/\.social-post-video-open \{[^}]*position: absolute;[^}]*inset: 0;[^}]*width: 100%;[^}]*height: 100%;/s)
    expect(styles).toMatch(/\.social-post-video-open:focus-visible \{[^}]*outline: 2px solid var\(--accent-control-foreground\);/s)
    expect(styles).toMatch(/\.social-post-video-controls \{[^}]*z-index: 1;/s)
    expect(styles).toMatch(/\.social-post-video-progress \{[^}]*z-index: 1;/s)
  })
})
