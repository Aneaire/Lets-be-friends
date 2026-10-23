import { type CircleDraftStorage } from './circleCreationDraft'

export function getCircleDraftStorage(): CircleDraftStorage {
  return {
    async read(key: string) {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    async write(key: string, value: string) {
      window.localStorage.setItem(key, value)
    },
    async remove(key: string) {
      try {
        window.localStorage.removeItem(key)
      } catch {
        // Local removal is best effort; a stale draft simply restores once.
      }
    },
  }
}
