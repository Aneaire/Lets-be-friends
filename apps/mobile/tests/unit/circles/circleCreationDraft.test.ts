import {
  clearMemberCircleDraft,
  CircleDraftController,
  circleDraftStorageKey,
  emptyCircleCreationDraft,
  isCircleCreationDraftEmpty,
  loadMemberCircleDraft,
  normalizeCircleCreationDraft,
  saveMemberCircleDraft,
} from '@/features/circles/circleCreationDraft'

function memoryStorage() {
  const store = new Map<string, string>()
  return {
    async read(key: string) { return store.get(key) ?? null },
    async write(key: string, value: string) { store.set(key, value) },
    async remove(key: string) { store.delete(key) },
  }
}

describe('circle creation drafts', () => {
  it('starts empty and stays empty when nothing was entered', () => {
    expect(isCircleCreationDraftEmpty(emptyCircleCreationDraft())).toBe(true)
  })

  it('saves and restores an unfinished draft for the same member', async () => {
    const storage = memoryStorage()
    const draft = {
      ...emptyCircleCreationDraft(),
      name: 'Cebu Coffee Friends',
      slug: 'cebu-coffee-friends',
      purpose: 'Weekend meetups',
      category: 'Coffee',
      mode: 'both' as const,
      approximateArea: 'Cebu City',
      rules: ['Treat every member with respect.'],
      updatedAt: 1,
    }
    await expect(saveMemberCircleDraft(storage, 'member-a', draft)).resolves.toBe(true)
    await expect(loadMemberCircleDraft(storage, 'member-a')).resolves.toMatchObject({ name: 'Cebu Coffee Friends' })
    await clearMemberCircleDraft(storage, 'member-a')
    await expect(loadMemberCircleDraft(storage, 'member-a')).resolves.toBeNull()
  })

  it('keeps drafts scoped to each member', async () => {
    const storage = memoryStorage()
    await saveMemberCircleDraft(storage, 'member-a', { ...emptyCircleCreationDraft(), name: 'Member A draft' })
    await expect(loadMemberCircleDraft(storage, 'member-b')).resolves.toBeNull()
    await expect(loadMemberCircleDraft(storage, 'member-a')).resolves.toMatchObject({ name: 'Member A draft' })
  })

  it('clears the stored draft when the form is empty', async () => {
    const storage = memoryStorage()
    await saveMemberCircleDraft(storage, 'member-b', { ...emptyCircleCreationDraft(), name: 'Draft' })
    await expect(saveMemberCircleDraft(storage, 'member-b', emptyCircleCreationDraft())).resolves.toBe(false)
    await expect(loadMemberCircleDraft(storage, 'member-b')).resolves.toBeNull()
  })

  it('rejects malformed stored drafts instead of restoring them', async () => {
    const storage = memoryStorage()
    await storage.write(circleDraftStorageKey('member-c'), JSON.stringify({ name: 'x' }))
    await expect(loadMemberCircleDraft(storage, 'member-c')).resolves.toBeNull()
    expect(normalizeCircleCreationDraft(null)).toBeNull()
    expect(normalizeCircleCreationDraft({ name: 'x', slug: 'x', purpose: 'x', category: 'x', approximateArea: '', mode: 'mars', rules: [] })).toBeNull()
  })

  it('treats unreadable storage as no draft rather than failing', async () => {
    const failing = {
      async read() { throw new Error('unavailable') },
      async write() { throw new Error('unavailable') },
      async remove() { throw new Error('unavailable') },
    }
    await expect(loadMemberCircleDraft(failing, 'member-d')).resolves.toBeNull()
    await expect(saveMemberCircleDraft(failing, 'member-d', { ...emptyCircleCreationDraft(), name: 'Draft' })).resolves.toBe(false)
    await expect(clearMemberCircleDraft(failing, 'member-d')).resolves.toBe(false)
  })

  it('uses Expo SecureStore-compatible keys for every member id character', () => {
    const key = circleDraftStorageKey('member:with/slash and ünicode')
    expect(key).toMatch(/^[A-Za-z0-9._-]+$/)
    expect(key).not.toContain(':')
  })

  it('serializes a delayed write before clear so discard cannot resurrect the draft', async () => {
    let releaseWrite!: () => void
    const writeGate = new Promise<void>((resolve) => { releaseWrite = resolve })
    const values = new Map<string, string>()
    const storage = {
      async read(key: string) { return values.get(key) ?? null },
      async write(key: string, value: string) { await writeGate; values.set(key, value) },
      async remove(key: string) { values.delete(key) },
    }
    const controller = new CircleDraftController(storage)
    await controller.switchMember('member-a', () => undefined)
    const pendingSave = controller.save({ ...emptyCircleCreationDraft(), name: 'Late draft' })
    const pendingClear = controller.clear()
    releaseWrite()
    await expect(pendingSave).resolves.toBe(true)
    await expect(pendingClear).resolves.toBe(true)
    await expect(storage.read(circleDraftStorageKey('member-a'))).resolves.toBeNull()
  })

  it('does not hydrate over typing or carry a delayed account read into another member', async () => {
    const reads = new Map<string, (value: string | null) => void>()
    const storage = {
      read(key: string) { return new Promise<string | null>((resolve) => { reads.set(key, resolve) }) },
      async write() {},
      async remove() {},
    }
    const controller = new CircleDraftController(storage)
    const applied: string[] = []
    const hydrationA = controller.switchMember('member-a', (draft) => applied.push(draft?.name ?? 'empty-a'))
    await Promise.resolve()
    const localSave = controller.save({ ...emptyCircleCreationDraft(), name: 'Typed A' })
    reads.get(circleDraftStorageKey('member-a'))?.(JSON.stringify({ ...emptyCircleCreationDraft(), name: 'Stored A' }))
    await hydrationA
    await localSave
    expect(applied).toEqual([])

    const hydrationB = controller.switchMember('member-b', (draft) => applied.push(draft?.name ?? 'empty-b'))
    await Promise.resolve()
    reads.get(circleDraftStorageKey('member-b'))?.(JSON.stringify({ ...emptyCircleCreationDraft(), name: 'Stored B' }))
    await hydrationB
    expect(applied).toEqual(['Stored B'])
  })
})
