import { createContext, type PropsWithChildren, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'

import { resolveTheme, type ColorScheme, type ThemeTokens } from './tokens'

const ThemeContext = createContext<ThemeTokens>(resolveTheme('light'))

export function AppThemeProvider({ children, scheme }: PropsWithChildren<{ scheme?: ColorScheme }>) {
  const colorScheme = useColorScheme()
  const theme = useMemo(() => resolveTheme(scheme ?? (colorScheme === 'dark' ? 'dark' : 'light')), [colorScheme, scheme])

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export function useAppTheme() {
  return useContext(ThemeContext)
}
