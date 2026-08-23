import { brandAccentColors } from '@lets-be-friends/shared'

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

/**
 * Mobile-first density values shared by screens and reusable components.
 * Controls keep a comfortable touch target while visual padding stays compact.
 */
export const density = {
  screenGutter: 16,
  screenBottom: 32,
  tabletGutter: 20,
  sectionGap: 24,
  contentGap: 16,
  cardPadding: 14,
  compactCardPadding: 12,
  cardGap: 8,
  textPairGap: 2,
  textStackGap: 4,
  textSectionGap: 6,
  controlHeight: 48,
  compactControlHeight: 44,
  controlRadius: 14,
  sheetPadding: 14,
} as const

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const

export const typography = {
  display: { fontSize: 42, lineHeight: 44, fontWeight: '800' as const, letterSpacing: -1.4 },
  title: { fontSize: 28, lineHeight: 32, fontWeight: '800' as const, letterSpacing: -0.6 },
  heading: { fontSize: 20, lineHeight: 25, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '700' as const },
  label: { fontSize: 13, lineHeight: 17, fontWeight: '700' as const, letterSpacing: 0.5 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
} as const

export type ColorScheme = 'light' | 'dark'

export type ThemeColors = {
  background: string
  surface: string
  surfaceRaised: string
  text: string
  textMuted: string
  border: string
  borderStrong: string
  inverse: string
  inverseText: string
  accentText: string
  self: string
  social: string
  selfText: string
  socialText: string
  selfControl: string
  socialControl: string
  socialSoft: string
  selfSoft: string
  danger: string
  success: string
  warning: string
  successSoft: string
  warningSoft: string
  scrim: string
}

export type ThemeTokens = {
  scheme: ColorScheme
  colors: ThemeColors
  spacing: typeof spacing
  density: typeof density
  radii: typeof radii
  typography: typeof typography
}

const palettes: Record<ColorScheme, ThemeColors> = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceRaised: '#FFFFFF',
    text: '#090909',
    textMuted: '#5D5D5D',
    border: '#DEDEDE',
    borderStrong: '#A9A9A9',
    inverse: '#090909',
    inverseText: '#FFFFFF',
    accentText: '#FFFFFF',
    self: brandAccentColors.self.hex,
    social: brandAccentColors.social.hex,
    selfText: '#08679F',
    socialText: '#8B286B',
    selfControl: '#0875B8',
    socialControl: '#90336F',
    socialSoft: '#F7EAF2',
    selfSoft: '#E7F4FD',
    danger: '#B42318',
    success: '#17663A',
    warning: '#7A4A00',
    successSoft: '#EAF7EF',
    warningSoft: '#FFF5DD',
    scrim: 'rgba(0, 0, 0, 0.56)',
  },
  dark: {
    background: '#090909',
    surface: '#171717',
    surfaceRaised: '#202020',
    text: '#FFFFFF',
    textMuted: '#B8B8B8',
    border: '#353535',
    borderStrong: '#666666',
    inverse: '#FFFFFF',
    inverseText: '#090909',
    accentText: '#FFFFFF',
    self: brandAccentColors.self.hex,
    social: brandAccentColors.social.hex,
    selfText: '#6CC2FA',
    socialText: '#EA91C9',
    selfControl: '#0875B8',
    socialControl: '#90336F',
    socialSoft: '#321D2B',
    selfSoft: '#112B3C',
    danger: '#FF6B6B',
    success: '#6FD69B',
    warning: '#F2C66D',
    successSoft: '#163124',
    warningSoft: '#352A13',
    scrim: 'rgba(0, 0, 0, 0.72)',
  },
}

export function resolveTheme(scheme: ColorScheme | null | undefined): ThemeTokens {
  const resolvedScheme = scheme === 'dark' ? 'dark' : 'light'
  return {
    scheme: resolvedScheme,
    colors: palettes[resolvedScheme],
    spacing,
    density,
    radii,
    typography,
  }
}
