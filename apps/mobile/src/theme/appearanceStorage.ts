import type { AppearanceStorage } from './appearance'

function memoryStorage(): AppearanceStorage {
  let stored: string | null = null
  return {
    async read() {
      return stored
    },
    async write(value: string) {
      stored = value
    },
  }
}

let shared: AppearanceStorage | null = null

export function getAppearanceStorage(): AppearanceStorage {
  if (!shared) shared = memoryStorage()
  return shared
}
