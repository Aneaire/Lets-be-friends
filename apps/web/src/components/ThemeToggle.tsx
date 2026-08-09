import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

const themeStorageKey = 'lets-be-friends-theme'
const themeChangeEvent = 'lets-be-friends-theme-change'
const accentStorageKey = 'lets-be-friends-accent-theme'
const accentChangeEvent = 'lets-be-friends-accent-theme-change'
export type ThemeChoice = 'light' | 'dark'
export type AccentChoice = 'default' | 'reversed' | 'blue' | 'pink'

function getSystemTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: ThemeChoice) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.dataset.theme = theme
}

export function applyAccentChoice(accent: AccentChoice) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.accentTheme = accent
}

export function readStoredTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'light'

  try {
    const stored = window.localStorage.getItem(themeStorageKey)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    return getSystemTheme()
  }

  return getSystemTheme()
}

export function saveTheme(theme: ThemeChoice) {
  applyTheme(theme)
  try {
    window.localStorage.setItem(themeStorageKey, theme)
  } catch {
    // The visual theme still changes even if storage is blocked.
  }
  window.dispatchEvent(new CustomEvent<ThemeChoice>(themeChangeEvent, { detail: theme }))
}

export function readStoredAccentChoice(): AccentChoice {
  if (typeof window === 'undefined') return 'default'

  try {
    const stored = window.localStorage.getItem(accentStorageKey)
    if (stored === 'reversed' || stored === 'blue' || stored === 'pink') return stored
  } catch {
    // Use the default accents when storage is unavailable.
  }

  return 'default'
}

export function saveAccentChoice(accent: AccentChoice) {
  applyAccentChoice(accent)
  try {
    window.localStorage.setItem(accentStorageKey, accent)
  } catch {
    // The accent theme still changes even if storage is blocked.
  }
  window.dispatchEvent(new CustomEvent<AccentChoice>(accentChangeEvent, { detail: accent }))
}

export function useAccentChoice() {
  const [accent, setAccent] = useState<AccentChoice>('default')

  useEffect(() => {
    const resolved = readStoredAccentChoice()
    setAccent(resolved)
    applyAccentChoice(resolved)

    const syncAccent = (event: Event) => {
      setAccent((event as CustomEvent<AccentChoice>).detail)
    }
    window.addEventListener(accentChangeEvent, syncAccent)
    return () => window.removeEventListener(accentChangeEvent, syncAccent)
  }, [])

  return { accent, setAccent: saveAccentChoice }
}

export function useThemeChoice() {
  const [theme, setTheme] = useState<ThemeChoice>('light')

  useEffect(() => {
    const resolved = readStoredTheme()
    setTheme(resolved)
    applyTheme(resolved)

    const syncTheme = (event: Event) => {
      setTheme((event as CustomEvent<ThemeChoice>).detail)
    }
    window.addEventListener(themeChangeEvent, syncTheme)
    return () => window.removeEventListener(themeChangeEvent, syncTheme)
  }, [])

  return { theme, setTheme: saveTheme }
}

export function ThemeToggle() {
  const { theme, setTheme } = useThemeChoice()

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => {
        setTheme(nextTheme)
      }}
    >
      {theme === 'dark' ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
    </button>
  )
}
