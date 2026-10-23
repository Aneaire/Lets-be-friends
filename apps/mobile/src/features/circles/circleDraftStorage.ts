import type { CircleDraftStorage } from './circleCreationDraft'

function memoryDraftStorage(): CircleDraftStorage {
  const store = new Map<string, string>()
  return {
    async read(key: string) {
      return store.get(key) ?? null
    },
    async write(key: string, value: string) {
      store.set(key, value)
    },
    async remove(key: string) {
      store.delete(key)
    },
  }
}

let shared: CircleDraftStorage | null = null

/** Default in-memory store. Metro and jest-expo resolve the platform file (`.native`, `.web`) when present. */
export function getCircleDraftStorage(): CircleDraftStorage {
  if (!shared) shared = memoryDraftStorage()
  return shared
}
