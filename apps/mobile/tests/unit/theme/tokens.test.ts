import { brandAccentColors } from '@lets-be-friends/shared'

import { resolveTheme } from '@/theme/tokens'

function contrastRatio(first: string, second: string) {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/.{2}/g)!.map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const brighter = Math.max(luminance(first), luminance(second))
  const darker = Math.min(luminance(first), luminance(second))
  return (brighter + 0.05) / (darker + 0.05)
}

describe('semantic theme tokens', () => {
  it('uses the shared brand intents consistently in both system themes', () => {
    const light = resolveTheme('light')
    const dark = resolveTheme('dark')

    expect(light.colors.self).toBe(brandAccentColors.self.hex)
    expect(light.colors.social).toBe(brandAccentColors.social.hex)
    expect(dark.colors.self).toBe(brandAccentColors.self.hex)
    expect(dark.colors.social).toBe(brandAccentColors.social.hex)
    expect(light.colors.accentText).toBe('#FFFFFF')
    expect(dark.colors.accentText).toBe('#FFFFFF')
    expect(light.colors.selfControl).toBe(dark.colors.selfControl)
    expect(light.colors.socialControl).toBe(dark.colors.socialControl)
    for (const palette of [light.colors, dark.colors]) {
      expect(contrastRatio(palette.selfText, palette.background)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(palette.selfText, palette.surfaceRaised)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(palette.socialText, palette.background)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(palette.socialText, palette.surfaceRaised)).toBeGreaterThanOrEqual(4.5)
    }
    expect(light.colors.background).not.toBe(dark.colors.background)
    expect(light.colors.text).not.toBe(dark.colors.text)
  })

  it('falls back to the light system palette when the scheme is unavailable', () => {
    expect(resolveTheme(undefined).scheme).toBe('light')
    expect(resolveTheme(null).colors).toEqual(resolveTheme('light').colors)
  })
})
