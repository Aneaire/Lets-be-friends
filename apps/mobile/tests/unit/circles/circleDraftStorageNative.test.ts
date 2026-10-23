import { circleDraftStorageKey } from '@/features/circles/circleCreationDraft'
import { createNativeCircleDraftStorage } from '@/features/circles/circleDraftStorage.native'

describe('native Circle draft storage adapter', () => {
  it('passes a legal member-scoped key through the actual SecureStore adapter', async () => {
    const mockGetItemAsync = jest.fn().mockResolvedValueOnce('{"name":"draft"}')
    const mockSetItemAsync = jest.fn().mockResolvedValue(undefined)
    const mockDeleteItemAsync = jest.fn().mockResolvedValue(undefined)
    const storage = createNativeCircleDraftStorage({ getItemAsync: mockGetItemAsync, setItemAsync: mockSetItemAsync, deleteItemAsync: mockDeleteItemAsync })
    const key = circleDraftStorageKey('member:id/1')
    await expect(storage.read(key)).resolves.toBe('{"name":"draft"}')
    await storage.write(key, 'value')
    await storage.remove(key)
    expect(key).toMatch(/^[A-Za-z0-9._-]+$/)
    expect(mockGetItemAsync).toHaveBeenCalledWith(key)
    expect(mockSetItemAsync).toHaveBeenCalledWith(key, 'value')
    expect(mockDeleteItemAsync).toHaveBeenCalledWith(key)
  })
})
