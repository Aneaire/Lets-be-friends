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

  it('keeps the minimal video overlay legible across bright and dark videos', () => {
    expect(styles).toMatch(
      /\.social-video-controls\s*\{[^}]*right:\s*0;[^}]*bottom:\s*0;[^}]*left:\s*0;/s,
    )
    expect(styles).toMatch(
      /\.social-video-button\s*\{[^}]*color:\s*var\(--accent-control-foreground\);/s,
    )
    const controlsRule = /\.social-video-controls\s*\{([^}]*)\}/.exec(styles)
    expect(controlsRule?.[1]).not.toContain('background:')
    expect(styles).toMatch(
      /\.social-video-button\.social-video-play\s*\{[^}]*background:\s*oklch\(0% 0 0 \/ 55%\);/s,
    )
    expect(styles).toMatch(
      /\.social-video-scrub\s*\{[^}]*width:\s*calc\(100% \+ 1\.25rem\);/s,
    )
    expect(styles).toMatch(
      /\.social-video-scrub-track\s*\{[^}]*background:\s*rgb\(255 255 255 \/ 35%\);/s,
    )
    expect(styles).toMatch(
      /\.social-video-scrub-fill\s*\{[^}]*background:\s*oklch\(100% 0 0\);/s,
    )
  })

  it('keeps the mute toggle on the upper-left of the video', () => {
    expect(styles).toMatch(
      /\.social-video-mute-float\s*\{[^}]*top:\s*0\.625rem;[^}]*left:\s*0\.625rem;/s,
    )
  })
})
