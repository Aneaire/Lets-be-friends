export interface CircleDraftStorage {
  read(key: string): Promise<string | null>
  write(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export function circleDraftStorageKey(memberId: string) {
  const encodedMember = Array.from(memberId, (character) => character.codePointAt(0)!.toString(16)).join('_')
  return `lbf.circle.draft.v1.${encodedMember}`
}

export type CircleCreationDraft = {
  name: string
  slug: string
  purpose: string
  category: string
  mode: 'online' | 'in_person' | 'both'
  approximateArea: string
  rules: string[]
  updatedAt: number
}

export function emptyCircleCreationDraft(): CircleCreationDraft {
  return { name: '', slug: '', purpose: '', category: '', mode: 'online', approximateArea: '', rules: [], updatedAt: 0 }
}

export function isCircleCreationDraftEmpty(draft: CircleCreationDraft): boolean {
  return !draft.name.trim() && !draft.slug.trim() && !draft.purpose.trim() && !draft.category.trim() && !draft.approximateArea.trim() && draft.rules.length === 0
}

export function normalizeCircleCreationDraft(value: unknown, now = Date.now()): CircleCreationDraft | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<CircleCreationDraft>
  if (typeof candidate.name !== 'string' || typeof candidate.slug !== 'string' || typeof candidate.purpose !== 'string') return null
  if (typeof candidate.category !== 'string' || typeof candidate.approximateArea !== 'string') return null
  if (!Array.isArray(candidate.rules) || !candidate.rules.every((rule) => typeof rule === 'string')) return null
  if (candidate.mode !== 'online' && candidate.mode !== 'in_person' && candidate.mode !== 'both') return null
  return {
    name: candidate.name.slice(0, 80),
    slug: candidate.slug.slice(0, 60),
    purpose: candidate.purpose.slice(0, 500),
    category: candidate.category.slice(0, 60),
    mode: candidate.mode,
    approximateArea: candidate.approximateArea.slice(0, 80),
    rules: candidate.rules.slice(0, 10),
    updatedAt: typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : now,
  }
}

/**
 * Member-scoped draft persistence. Drafts survive app restarts through the
 * platform store (SecureStore on native, local storage on web) and are keyed
 * by member id so account switching never leaks one member's draft into
 * another member's form.
 */
export async function loadMemberCircleDraft(storage: CircleDraftStorage, memberId: string): Promise<CircleCreationDraft | null> {
  try {
    const raw = await storage.read(circleDraftStorageKey(memberId))
    if (!raw) return null
    return normalizeCircleCreationDraft(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export async function saveMemberCircleDraft(storage: CircleDraftStorage, memberId: string, draft: CircleCreationDraft): Promise<boolean> {
  const key = circleDraftStorageKey(memberId)
  if (isCircleCreationDraftEmpty(draft)) {
    try {
      await storage.remove(key)
    } catch {
      // Best effort: a stale empty draft restores as nothing.
    }
    return false
  }
  try {
    await storage.write(key, JSON.stringify({ ...draft, updatedAt: Date.now() }))
    return true
  } catch {
    return false
  }
}

export async function clearMemberCircleDraft(storage: CircleDraftStorage, memberId: string) {
  try {
    await storage.remove(circleDraftStorageKey(memberId))
    return true
  } catch {
    return false
  }
}

/**
 * Serializes persistence and ties hydration to one member generation. The UI
 * can safely type while a read is delayed: that delayed value is ignored once
 * the current generation has local edits. Clears are queued after all earlier
 * writes, so a discarded draft cannot be restored by a late write.
 */
export class CircleDraftController {
  private generation = 0
  private revision = 0
  private memberId: string | null = null
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly storage: CircleDraftStorage) {}

  switchMember(memberId: string | null, apply: (draft: CircleCreationDraft | null) => void): Promise<void> {
    this.generation += 1
    this.revision = 0
    this.memberId = memberId
    const generation = this.generation
    if (!memberId) return Promise.resolve()
    const startRevision = this.revision
    return this.enqueue(async () => {
      const draft = await loadMemberCircleDraft(this.storage, memberId)
      if (this.generation === generation && this.memberId === memberId && this.revision === startRevision) apply(draft)
    })
  }

  save(draft: CircleCreationDraft): Promise<boolean> {
    const memberId = this.memberId
    this.revision += 1
    if (!memberId) return Promise.resolve(false)
    return this.enqueue(() => saveMemberCircleDraft(this.storage, memberId, draft))
  }

  clear(): Promise<boolean> {
    const memberId = this.memberId
    this.revision += 1
    if (!memberId) return Promise.resolve(true)
    return this.enqueue(() => clearMemberCircleDraft(this.storage, memberId))
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }
}
