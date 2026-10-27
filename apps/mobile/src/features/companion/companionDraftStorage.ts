import type { CompanionDraftStorage } from './companionDraft'

/** Safe fallback for runtimes without native files. */
export function getCompanionDraftStorage(): CompanionDraftStorage {
  return { async read() { return null }, async write() {}, async remove() {} }
}
