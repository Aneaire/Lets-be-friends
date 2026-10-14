export type CompanionApplicationDraft = {
  mode: 'online' | 'in_person' | 'both'
  city: string
  hourlyRatePesos: string
  intro: string
  bio: string
  selectedCategories: string[]
}

const draftVersion = 2

export function companionApplicationDraftKey(userId: string) {
  return `lbf:companion-application-draft:v${draftVersion}:${userId}`
}

export function readCompanionApplicationDraft(storage: Pick<Storage, 'getItem'>, userId: string) {
  try {
    const value = JSON.parse(storage.getItem(companionApplicationDraftKey(userId)) ?? 'null') as unknown
    if (!isCompanionApplicationDraft(value)) return null
    return value
  } catch {
    return null
  }
}

export function writeCompanionApplicationDraft(storage: Pick<Storage, 'setItem'>, userId: string, draft: CompanionApplicationDraft) {
  storage.setItem(companionApplicationDraftKey(userId), JSON.stringify(draft))
}

export function clearCompanionApplicationDraft(storage: Pick<Storage, 'removeItem'>, userId: string) {
  storage.removeItem(companionApplicationDraftKey(userId))
}

function isCompanionApplicationDraft(value: unknown): value is CompanionApplicationDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<CompanionApplicationDraft>
  return ['online', 'in_person', 'both'].includes(draft.mode ?? '')
    && [draft.city, draft.hourlyRatePesos, draft.intro, draft.bio].every((item) => typeof item === 'string')
    && Array.isArray(draft.selectedCategories)
    && draft.selectedCategories.every((item) => typeof item === 'string')
}
