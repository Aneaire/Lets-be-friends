import { CompanionDraftController, companionDraftKey, hydrateCompanionForm, normalizeCompanionDraft, type CompanionDraftStorage } from '@/features/companion/companionDraft'
import { initialCompanionApplicationForm } from '@/data/companionTools'

function storage() {
  const records = new Map<string, string>()
  const store: CompanionDraftStorage = { async read(key) { return records.get(key) ?? null }, async write(key, value) { records.set(key, value) }, async remove(key) { records.delete(key) } }
  return { records, store }
}
const draft = { ...initialCompanionApplicationForm(), intro: 'My unsaved experience', bio: 'Local bio', categories: ['Walking'] }

it('hydrates the saved application before applying draft overrides', () => {
  expect(hydrateCompanionForm({ intro: 'Saved intro', bio: 'Saved bio', city: 'Manila', mode: 'online', strengths: [], categories: [], boundaries: [] }, null)).toMatchObject({ intro: 'Saved intro', city: 'Manila' })
  expect(hydrateCompanionForm({ intro: 'Saved intro', bio: 'Saved bio', city: 'Manila', mode: 'online', strengths: [], categories: [], boundaries: [] }, draft)).toEqual(draft)
  expect(normalizeCompanionDraft({ ...draft, categories: [3] })).toBeNull()
})
it('isolates accounts, persists every field, and clears after save', async () => {
  const { store, records } = storage()
  const controller = new CompanionDraftController(store)
  await controller.switchAccount('a', () => {})
  await controller.save(draft)
  await controller.switchAccount('b', value => expect(value).toBeNull())
  await controller.save({ ...draft, city: 'Cebu' })
  await controller.switchAccount('a', value => expect(value).toEqual(draft))
  const write = controller.save(draft)
  const clear = controller.clear()
  await Promise.all([write, clear])
  expect(records.has(companionDraftKey('a'))).toBe(false)
  expect(records.has(companionDraftKey('b'))).toBe(true)
})
it('ignores malformed data and storage errors', async () => {
  const { store, records } = storage()
  records.set(companionDraftKey('a'), '{bad json')
  await new CompanionDraftController(store).switchAccount('a', value => expect(value).toBeNull())
  records.set(companionDraftKey('a'), JSON.stringify({ intro: 1 }))
  await new CompanionDraftController(store).switchAccount('a', value => expect(value).toBeNull())
})
it('does not apply a delayed read after an edit or account switch', async () => {
  let resolve!: (value: string) => void
  const read = new Promise<string>(done => { resolve = done })
  const apply = jest.fn()
  const controller = new CompanionDraftController({ async read() { return read }, async write() {}, async remove() {} })
  const pending = controller.switchAccount('a', apply)
  const edit = controller.save(draft)
  resolve(JSON.stringify(draft))
  await pending
  await edit
  expect(apply).not.toHaveBeenCalled()
  await controller.switchAccount(null, apply)
})

it('does not hydrate an old account after switching accounts during a read', async () => {
  let resolve!: (raw: string) => void
  const oldRead = new Promise<string>(done => { resolve = done })
  const oldApply = jest.fn()
  const newApply = jest.fn()
  const controller = new CompanionDraftController({ async read(key) { return key === companionDraftKey('a') ? oldRead : null }, async write() {}, async remove() {} })
  const old = controller.switchAccount('a', oldApply)
  const next = controller.switchAccount('b', newApply)
  resolve(JSON.stringify(draft))
  await Promise.all([old, next])
  expect(oldApply).not.toHaveBeenCalled()
  expect(newApply).toHaveBeenCalledWith(null)
})
