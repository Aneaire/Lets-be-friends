import { appearanceStorageKey, type AppearanceStorage } from './appearance'

export function getAppearanceStorage(): AppearanceStorage {
  return {
    async read() {
      try {
        return window.localStorage.getItem(appearanceStorageKey)
      } catch {
        return null
      }
    },
    async write(value: string) {
      window.localStorage.setItem(appearanceStorageKey, value)
    },
  }
}
