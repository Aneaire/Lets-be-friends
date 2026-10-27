import { initialCompanionApplicationForm, type CompanionApplicationForm, type SavedCompanionApplication } from '@/data/companionTools'

export type CompanionDraftStorage = {
  read(key: string): Promise<string | null>
  write(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}
export function companionDraftKey(accountId: string) { return `companion-draft-${encodeURIComponent(accountId)}.json` }
export function normalizeCompanionDraft(value: unknown): CompanionApplicationForm | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as CompanionApplicationForm
  if (!['online', 'in_person', 'both'].includes(draft.mode)) return null
  for (const key of ['city', 'hourlyRatePesos', 'bio', 'intro', 'boundaries', 'applicationNote'] as const) {
    if (typeof draft[key] !== 'string' || draft[key].length > 10000) return null
  }
  for (const key of ['strengths', 'categories'] as const) {
    if (!Array.isArray(draft[key]) || draft[key].length > 100 || !draft[key].every(item => typeof item === 'string')) return null
  }
  return { mode: draft.mode, city: draft.city, hourlyRatePesos: draft.hourlyRatePesos, bio: draft.bio, intro: draft.intro, boundaries: draft.boundaries, applicationNote: draft.applicationNote, strengths: [...draft.strengths], categories: [...draft.categories] }
}
export function hydrateCompanionForm(application: SavedCompanionApplication | null, draft: unknown) {
  return { ...initialCompanionApplicationForm(application), ...normalizeCompanionDraft(draft) }
}

/** Serializes writes and clears, and rejects stale reads after edits or account changes. */
export class CompanionDraftController {
  private accountId: string | null = null
  private generation = 0
  private revision = 0
  private queue: Promise<unknown> = Promise.resolve()
  constructor(private storage: CompanionDraftStorage) {}
  switchAccount(accountId: string | null, apply: (draft: CompanionApplicationForm | null) => void): Promise<void> {
    this.accountId = accountId
    const generation = ++this.generation
    const revision = this.revision = 0
    if (!accountId) return Promise.resolve()
    return this.enqueue(async () => {
      let draft = null
      try { const raw = await this.storage.read(companionDraftKey(accountId)); draft = raw ? normalizeCompanionDraft(JSON.parse(raw)) : null } catch { /* Invalid or unavailable storage restores the saved profile. */ }
      if (this.generation === generation && this.revision === revision) apply(draft)
    })
  }
  save(draft: CompanionApplicationForm) {
    const accountId = this.accountId
    this.revision++
    return this.enqueue(async () => {
      if (!accountId) return
      try { await this.storage.write(companionDraftKey(accountId), JSON.stringify(draft)) } catch { /* Best effort local persistence. */ }
    })
  }
  clear(accountId: string | null = this.accountId) {
    this.revision++
    return this.enqueue(async () => {
      if (!accountId) return
      try { await this.storage.remove(companionDraftKey(accountId)) } catch { /* Best effort local cleanup. */ }
    })
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.catch(() => undefined)
    return result
  }
}
