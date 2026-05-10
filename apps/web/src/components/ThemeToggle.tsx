import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

const themeStorageKey = 'lets-be-friends-theme'
type ThemeChoice = 'light' | 'dark'

function getSystemTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: ThemeChoice) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.dataset.theme = theme
}

function readStoredTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'light'

  try {
    const stored = window.localStorage.getItem(themeStorageKey)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    return getSystemTheme()
  }

  return getSystemTheme()
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>('light')

  useEffect(() => {
    const resolved = readStoredTheme()
    setTheme(resolved)
    applyTheme(resolved)
  }, [])

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => {
        setTheme(nextTheme)
        applyTheme(nextTheme)
        try {
          window.localStorage.setItem(themeStorageKey, nextTheme)
        } catch {
          // The visual theme still changes even if storage is blocked.
        }
      }}
    >
      {theme === 'dark' ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
    </button>
  )
}
