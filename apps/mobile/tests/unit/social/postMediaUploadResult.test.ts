import { uploadedStorageId } from '@/features/social/postMediaUploadResult'

describe('post media upload responses', () => {
  it('returns the storage ID from a successful upload', () => {
    expect(uploadedStorageId(200, JSON.stringify({ storageId: 'storage-123' }))).toBe('storage-123')
  })

  it.each([
    [500, JSON.stringify({ storageId: 'storage-123' })],
    [200, JSON.stringify({})],
    [200, 'not-json'],
  ])('rejects an unsuccessful or incomplete upload response', (status, body) => {
    expect(uploadedStorageId(status, body)).toBeUndefined()
  })
})
