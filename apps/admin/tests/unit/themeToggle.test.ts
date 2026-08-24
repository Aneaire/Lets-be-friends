// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import {
  applyTheme,
  readStoredTheme,
  saveTheme,
} from '../../src/design-system/atoms/ThemeToggle'

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
  delete document.documentElement.dataset.theme
})

describe('admin theme contract', () => {
  it('applies the selected theme to the root document', () => {
    applyTheme('dark')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('dark')

    applyTheme('light')

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('persists and reads the shared theme choice', () => {
    saveTheme('dark')

    expect(window.localStorage.getItem('lets-be-friends-theme')).toBe('dark')
    expect(readStoredTheme()).toBe('dark')
  })
})
