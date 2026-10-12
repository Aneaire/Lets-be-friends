import type { CircleId, StorageId } from '@/backend/client'
import {
  CIRCLE_IMAGE_SIZE_MESSAGE,
  CIRCLE_IMAGE_STILL_MESSAGE,
  CIRCLE_IMAGE_TYPE_MESSAGE,
  CIRCLE_IMAGE_UPLOAD_MESSAGE,
  uploadCircleImage,
  type CircleImageUploadDeps,
} from '@/features/circles/circleImageUpload'

const circleId = 'circle-1' as CircleId

function deps(overrides: Partial<CircleImageUploadDeps> = {}) {
  const generateUploadUrl = jest.fn(async () => 'https://uploads.example/circle')
  const setImage = jest.fn(async () => undefined)
  const prepareMedia = jest.fn(async ({ uri, mimeType }: { uri: string; mimeType: string }) => ({
    uri,
    mimeType,
    fileSize: 1024,
  }))
  const uploadMedia = jest.fn(async () => 'storage-1')
  return {
    generateUploadUrl,
    setImage,
    prepareMedia,
    uploadMedia,
    ...overrides,
  } as unknown as CircleImageUploadDeps & {
    generateUploadUrl: jest.Mock
    setImage: jest.Mock
    prepareMedia: jest.Mock
    uploadMedia: jest.Mock
  }
}

describe('mobile Circle image upload orchestration', () => {
  it('does nothing when the picker is canceled so a retry stays possible', async () => {
    const d = deps()
    await expect(
      uploadCircleImage({ circleId, kind: 'icon', asset: null, deps: d }),
    ).resolves.toBeNull()
    expect(d.prepareMedia).not.toHaveBeenCalled()
    expect(d.generateUploadUrl).not.toHaveBeenCalled()
    expect(d.uploadMedia).not.toHaveBeenCalled()
    expect(d.setImage).not.toHaveBeenCalled()
  })

  it('uploads a still image through the shared pipeline and applies the returned id', async () => {
    const d = deps()
    const storageId = await uploadCircleImage({
      circleId,
      kind: 'cover',
      asset: { uri: 'file:///photo.jpg', type: 'image', mimeType: 'image/jpeg', fileName: 'photo.jpg' },
      deps: d,
    })
    expect(storageId).toBe('storage-1')
    expect(d.prepareMedia).toHaveBeenCalledWith({ uri: 'file:///photo.jpg', mimeType: 'image/jpeg' })
    expect(d.uploadMedia).toHaveBeenCalledWith(
      'https://uploads.example/circle',
      expect.objectContaining({ mimeType: 'image/jpeg', fileSize: 1024 }),
    )
    expect(d.setImage).toHaveBeenCalledWith({ circleId, kind: 'cover', storageId: 'storage-1' as StorageId })
  })

  it('rejects a picker-reported oversize asset without touching the backend', async () => {
    const d = deps()
    await expect(
      uploadCircleImage({
        circleId,
        kind: 'icon',
        asset: { uri: 'file:///big.jpg', type: 'image', mimeType: 'image/jpeg', fileName: 'big.jpg', fileSize: 6 * 1024 * 1024 },
        deps: d,
      }),
    ).rejects.toThrow(CIRCLE_IMAGE_SIZE_MESSAGE)
    expect(d.prepareMedia).not.toHaveBeenCalled()
    expect(d.setImage).not.toHaveBeenCalled()
  })

  it('rejects an oversize verified size without applying the image', async () => {
    const d = deps({
      prepareMedia: jest.fn(async ({ uri, mimeType }: { uri: string; mimeType: string }) => ({
        uri,
        mimeType,
        fileSize: 6 * 1024 * 1024,
      })) as unknown as CircleImageUploadDeps['prepareMedia'],
    })
    await expect(
      uploadCircleImage({
        circleId,
        kind: 'icon',
        asset: { uri: 'file:///photo.png', type: 'image', mimeType: 'image/png', fileName: 'photo.png' },
        deps: d,
      }),
    ).rejects.toThrow(CIRCLE_IMAGE_SIZE_MESSAGE)
    expect(d.generateUploadUrl).not.toHaveBeenCalled()
    expect(d.setImage).not.toHaveBeenCalled()
  })

  it('rejects a non-still image mime type without applying the image', async () => {
    const d = deps()
    await expect(
      uploadCircleImage({
        circleId,
        kind: 'icon',
        asset: { uri: 'file:///clip.mp4', type: 'video', mimeType: 'video/mp4', fileName: 'clip.mp4' },
        deps: d,
      }),
    ).rejects.toThrow(CIRCLE_IMAGE_STILL_MESSAGE)
    expect(d.setImage).not.toHaveBeenCalled()
  })

  it('rejects an unsupported still-image type without applying the image', async () => {
    const d = deps()
    await expect(
      uploadCircleImage({
        circleId,
        kind: 'icon',
        asset: { uri: 'file:///photo.gif', type: 'image', mimeType: 'image/gif', fileName: 'photo.gif' },
        deps: d,
      }),
    ).rejects.toThrow(CIRCLE_IMAGE_TYPE_MESSAGE)
    expect(d.setImage).not.toHaveBeenCalled()
  })

  it('never applies the image when the shared upload fails', async () => {
    const d = deps({
      uploadMedia: jest.fn(async () => {
        throw new Error('A media upload failed. No media was attached to your post.')
      }) as unknown as CircleImageUploadDeps['uploadMedia'],
    })
    await expect(
      uploadCircleImage({
        circleId,
        kind: 'icon',
        asset: { uri: 'file:///photo.webp', type: 'image', mimeType: 'image/webp', fileName: 'photo.webp' },
        deps: d,
      }),
    ).rejects.toThrow(CIRCLE_IMAGE_UPLOAD_MESSAGE)
    expect(d.setImage).not.toHaveBeenCalled()
  })

  it('never applies the image when the upload returns no storage id', async () => {
    const d = deps({
      uploadMedia: jest.fn(async () => '') as unknown as CircleImageUploadDeps['uploadMedia'],
    })
    await expect(
      uploadCircleImage({
        circleId,
        kind: 'cover',
        asset: { uri: 'file:///photo.jpg', type: 'image', mimeType: 'image/jpeg', fileName: 'photo.jpg' },
        deps: d,
      }),
    ).rejects.toThrow(CIRCLE_IMAGE_UPLOAD_MESSAGE)
    expect(d.setImage).not.toHaveBeenCalled()
  })
})
