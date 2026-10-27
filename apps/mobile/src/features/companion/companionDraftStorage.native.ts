import { File, Paths } from 'expo-file-system'
import type { CompanionDraftStorage } from './companionDraft'

export function getCompanionDraftStorage(): CompanionDraftStorage {
  return {
    async read(key) { const file = new File(Paths.document, key); return file.exists ? file.text() : null },
    async write(key, value) { const file = new File(Paths.document, key); file.write(value) },
    async remove(key) { const file = new File(Paths.document, key); if (file.exists) file.delete() },
  }
}
