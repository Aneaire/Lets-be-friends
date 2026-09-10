import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8')

describe('post media layout styles', () => {
  it('makes a single image fill the postcard width within a height cap', () => {
    expect(styles).toMatch(
      /\.social-media-grid\[data-count="1"\] \.social-media-item\s*\{[^}]*width:\s*100%;[^}]*aspect-ratio:\s*16 \/ 10;[^}]*max-height:\s*min\(34rem, 68vh\);/s,
    )
  })

  it('crops a portrait image from the center within a bounded full-width card', () => {
    expect(styles).toMatch(
      /\.social-media-grid\[data-count="1"\] \.social-media-item\[data-layout="portrait"\]\s*\{[^}]*width:\s*100%;[^}]*aspect-ratio:\s*4 \/ 5;[^}]*max-height:\s*min\(42rem, 75vh\);/s,
    )
    expect(styles).toMatch(
      /\.social-media-grid\[data-count="1"\] \.social-media-item\[data-layout="portrait"\] img\s*\{[^}]*object-fit:\s*cover;[^}]*object-position:\s*center;/s,
    )
  })

  it('keeps the mute control visible on the lower-right of bright and dark videos', () => {
    expect(styles).toMatch(
      /\.social-post-video-controls\s*\{[^}]*right:\s*0\.75rem;[^}]*bottom:\s*0\.75rem;/s,
    )
    expect(styles).toMatch(
      /\.social-post-video-mute\s*\{[^}]*background:\s*color-mix\(in oklch, var\(--media-stage\) 76%, transparent\);[^}]*color:\s*var\(--accent-control-foreground\);/s,
    )
  })
})
