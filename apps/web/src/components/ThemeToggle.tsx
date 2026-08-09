import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

const themeStorageKey = 'lets-be-friends-theme'
const themeChangeEvent = 'lets-be-friends-theme-change'
export type ThemeChoice = 'light' | 'dark'

function getSystemTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: ThemeChoice) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.dataset.theme = theme
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
