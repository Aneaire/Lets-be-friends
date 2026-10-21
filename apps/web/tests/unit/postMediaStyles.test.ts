import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8')

describe('post media layout styles', () => {
  it('sizes a single image or video from its fluid aspect with a landscape fallback', () => {
    expect(styles).toMatch(
      /\.social-media-grid\[data-count="1"\] \.social-media-item\s*\{[^}]*width:\s*100%;[^}]*aspect-ratio:\s*var\(--social-media-aspect,\s*16 \/ 10\);[^}]*max-height:\s*min\(34rem, 68vh\);/s,
    )
  })

  it('keeps two, four, and five photo collages in one calm block', () => {
    expect(styles).toMatch(
      /\.social-media-grid\[data-count="2"\]\s*\{[^}]*aspect-ratio:\s*2 \/ 1;/s,
    )
    expect(styles).toMatch(
      /\.social-media-grid\[data-count="4"\]\s*\{[^}]*aspect-ratio:\s*1 \/ 1;/s,
    )
    expect(styles).toMatch(
      /\.social-media-grid\[data-count="5"\]\s*\{[^}]*aspect-ratio:\s*3 \/ 2;/s,
    )
  })

  it('puts the first of three photos beside two stacked photos', () => {
    expect(styles).toMatch(
      /\.social-media-grid\[data-count="3"\]\s*\{[^}]*grid-template-columns:\s*2fr 1fr;[^}]*grid-template-rows:\s*1fr 1fr;[^}]*aspect-ratio:\s*3 \/ 2;/s,
    )
    expect(styles).toMatch(
      /\.social-media-grid\[data-count="3"\] \.social-media-item:first-child\s*\{[^}]*grid-row:\s*span 2;/s,
    )
  })

  it('no longer forces a fixed portrait crop', () => {
    expect(styles).not.toContain('.social-media-item[data-layout="portrait"]')
  })

  it('uses the same collage blocks in the composer preview', () => {
    expect(styles).toMatch(
      /\.social-media-preview-grid\[data-count="3"\],\s*\.social-media-grid\[data-count="3"\]\s*\{[^}]*aspect-ratio:\s*3 \/ 2;/s,
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
