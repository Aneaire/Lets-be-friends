import { brandAccentColors } from '@lets-be-friends/shared'

import { resolveTheme } from '@/theme/tokens'

describe('semantic theme tokens', () => {
  it('uses the shared brand intents consistently in both system themes', () => {
    const light = resolveTheme('light')
    const dark = resolveTheme('dark')

    expect(light.colors.self).toBe(brandAccentColors.self.hex)
    expect(light.colors.social).toBe(brandAccentColors.social.hex)
    expect(dark.colors.self).toBe(brandAccentColors.self.hex)
    expect(dark.colors.social).toBe(brandAccentColors.social.hex)
    expect(light.colors.accentText).toBe('#090909')
    expect(dark.colors.accentText).toBe('#090909')
    expect(light.colors.background).not.toBe(dark.colors.background)
    expect(light.colors.text).not.toBe(dark.colors.text)
  })

  it('falls back to the light system palette when the scheme is unavailable', () => {
    expect(resolveTheme(undefined).scheme).toBe('light')
    expect(resolveTheme(null).colors).toEqual(resolveTheme('light').colors)
  })
})
