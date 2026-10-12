import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useColorScheme } from 'react-native'

import {
  appearanceStateForLoad,
  appearanceStateForSave,
  initialAppearanceState,
  loadThemePreference,
  resolveEffectiveScheme,
  saveThemePreference,
  type AppearanceState,
  type ThemePreference,
} from './appearance'
import { getAppearanceStorage } from './appearanceStorage'
import { resolveTheme, type ColorScheme, type ThemeTokens } from './tokens'

const ThemeContext = createContext<ThemeTokens>(resolveTheme('light'))
const AppearanceContext = createContext<{
  state: AppearanceState
  setPreference: (preference: ThemePreference) => Promise<void>
  retry: () => void
}>({
  state: initialAppearanceState(),
  setPreference: async () => undefined,
  retry: () => undefined,
})

export function AppThemeProvider({ children, scheme }: PropsWithChildren<{ scheme?: ColorScheme }>) {
  const colorScheme = useColorScheme()
  const [appearance, setAppearance] = useState<AppearanceState>(() => initialAppearanceState())
  const [reloadToken, setReloadToken] = useState(0)
  const saving = useRef(false)
  const requestSeq = useRef(0)

  useEffect(() => {
    if (scheme) return
    const requestId = (requestSeq.current += 1)
    // Preserve the current choice while reloading so a slow load never flashes
    // back to System over a ready or just-saved preference.
    setAppearance((current) => ({
      status: 'loading',
      preference: current.status === 'ready' ? current.preference : 'system',
      message: 'Loading your appearance choice.',
    }))
    void loadThemePreference(getAppearanceStorage()).then((result) => {
      if (requestSeq.current !== requestId) return
      setAppearance(appearanceStateForLoad(result))
    })
    return () => {
      // A newer load or save bumps requestSeq, so this stale result is ignored.
    }
  }, [scheme, reloadToken])

  const setPreference = useCallback(async (preference: ThemePreference) => {
    if (saving.current) return
    saving.current = true
    const requestId = (requestSeq.current += 1)
    try {
      const result = await saveThemePreference(getAppearanceStorage(), preference)
      if (requestSeq.current !== requestId) return
      setAppearance((current) => appearanceStateForSave(current, preference, result))
    } finally {
      saving.current = false
    }
  }, [])

  const retry = useCallback(() => setReloadToken((token) => token + 1), [])

  const theme = useMemo(() => {
    if (scheme) return resolveTheme(scheme)
    const systemScheme = colorScheme === 'dark' ? 'dark' : 'light'
    return resolveTheme(resolveEffectiveScheme(appearance.preference, systemScheme))
  }, [appearance.preference, colorScheme, scheme])

  const appearanceValue = useMemo(() => ({ state: appearance, setPreference, retry }), [appearance, retry, setPreference])

  return (
    <AppearanceContext.Provider value={appearanceValue}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </AppearanceContext.Provider>
  )
}

export function useAppTheme() {
  return useContext(ThemeContext)
}

export function useThemePreference() {
  return useContext(AppearanceContext)
}
