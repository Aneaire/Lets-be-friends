import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8')

describe('review media layout styles', () => {
  it('sizes a single review photo from its fluid aspect within a height cap', () => {
    expect(styles).toMatch(
      /\.social-review-image-single\s*\{[^}]*width:\s*100%;[^}]*aspect-ratio:\s*var\(--social-review-aspect,\s*16 \/ 10\);[^}]*max-height:\s*min\(34rem, 68vh\);/s,
    )
  })

  it('keeps three review photos in a large-left and two-stacked collage', () => {
    expect(styles).toMatch(
      /\.social-review-image-grid\[data-count="3"\]\s*\{[^}]*grid-template-columns:\s*2fr 1fr;[^}]*grid-template-rows:\s*1fr 1fr;[^}]*aspect-ratio:\s*3 \/ 2;/s,
    )
    expect(styles).toMatch(
      /\.social-review-image-grid\[data-count="3"\] > \*:first-child\s*\{[^}]*grid-row:\s*span 2;/s,
    )
  })

  it('does not force a single review photo into a fixed aspect ratio', () => {
    const openImageRule = /\.social-review-image-open img\s*\{([^}]*)\}/.exec(styles)
    expect(openImageRule?.[1]).not.toContain('aspect-ratio')
    expect(openImageRule?.[1]).toContain('height: 100%')
  })

  it('lets a profile review photo fill the card width like a post photo', () => {
    expect(styles).toMatch(
      /\.profile-review-image\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;/s,
    )
    expect(styles).not.toMatch(/\.profile-review-image\s*\{[^}]*width:\s*min\(100%,\s*38rem\)/s)
  })

  it('keeps the profile review card compact between identity, stars, body, and media', () => {
    expect(styles).toMatch(
      /\.profile-review-card\s*\{[^}]*gap:\s*0\.5rem;[^}]*padding:\s*1rem;/s,
    )
  })
})
