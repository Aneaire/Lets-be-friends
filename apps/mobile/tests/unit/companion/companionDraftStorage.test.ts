const mockFiles = new Map<string, string>()
jest.mock('expo-file-system', () => ({
  Paths: { document: 'document' },
  File: class {
    key: string
    constructor(directory: string, key: string) { this.key = `${directory}/${key}` }
    get exists() { return mockFiles.has(this.key) }
    async text() { return mockFiles.get(this.key)! }
    write(value: string) { mockFiles.set(this.key, value) }
    delete() { mockFiles.delete(this.key) }
  },
}))
import { getCompanionDraftStorage } from '@/features/companion/companionDraftStorage.native'

it('writes durable account files, reads missing files safely, and deletes saved drafts', async () => {
  const first = getCompanionDraftStorage()
  expect(await first.read('account-a')).toBeNull()
  await first.write('account-a', 'draft')
  const afterRestart = getCompanionDraftStorage()
  expect(await afterRestart.read('account-a')).toBe('draft')
  expect(await afterRestart.read('account-b')).toBeNull()
  await afterRestart.remove('account-a')
  await afterRestart.remove('account-a')
  expect(await afterRestart.read('account-a')).toBeNull()
})
