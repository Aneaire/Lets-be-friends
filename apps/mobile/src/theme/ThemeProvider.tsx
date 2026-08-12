import { createContext, type PropsWithChildren, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'

import { resolveTheme, type ThemeTokens } from './tokens'

const ThemeContext = createContext<ThemeTokens>(resolveTheme('light'))

export function AppThemeProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme()
  const theme = useMemo(() => resolveTheme(colorScheme === 'dark' ? 'dark' : 'light'), [colorScheme])

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export function useAppTheme() {
  return useContext(ThemeContext)
}
