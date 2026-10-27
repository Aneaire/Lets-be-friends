const mockPermission = jest.fn()
const mockCreateAsset = jest.fn()
const mockDownload = jest.fn()
const mockFile = { uri: 'file:///cache/qr.png', exists: true, create: jest.fn(), write: jest.fn(), delete: jest.fn() }
jest.mock('expo-file-system', () => ({
  File: Object.assign(jest.fn(() => mockFile), { downloadFileAsync: (...args: unknown[]) => mockDownload(...args) }),
  Paths: { cache: 'file:///cache' },
}))
jest.mock('expo-media-library', () => ({ Asset: { create: (...args: unknown[]) => mockCreateAsset(...args) }, requestPermissionsAsync: (...args: unknown[]) => mockPermission(...args) }))

import { saveQrImageToPhotos } from '@/features/finance/saveQrImage'

describe('saving QR Ph to photos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPermission.mockResolvedValue({ granted: true })
    mockCreateAsset.mockResolvedValue({})
    mockDownload.mockResolvedValue(mockFile)
  })
  it('writes the provider base64 PNG locally instead of trying to download a data URL', async () => {
    expect(await saveQrImageToPhotos('data:image/png;base64,aGVsbG8=', 'top-up')).toEqual({ ok: true })
    expect(mockPermission).toHaveBeenCalledWith(true, ['photo'])
    expect(mockFile.create).toHaveBeenCalledWith({ overwrite: true })
    expect(mockFile.write).toHaveBeenCalledWith('aGVsbG8=', { encoding: 'base64' })
    expect(mockDownload).not.toHaveBeenCalled()
    expect(mockCreateAsset).toHaveBeenCalledWith(mockFile.uri)
    expect(mockFile.delete).toHaveBeenCalled()
  })
  it('continues to support HTTPS QR images', async () => {
    await saveQrImageToPhotos('https://example.test/qr.png', 'top-up')
    expect(mockDownload).toHaveBeenCalledWith('https://example.test/qr.png', mockFile, { idempotent: true })
    expect(mockCreateAsset).toHaveBeenCalledWith(mockFile.uri)
  })
  it('does not save or report success when permission is denied', async () => {
    mockPermission.mockResolvedValue({ granted: false })
    expect(await saveQrImageToPhotos('data:image/png;base64,aGVsbG8=', 'top-up')).toEqual({ ok: false, reason: 'permission' })
    expect(mockFile.write).not.toHaveBeenCalled()
    expect(mockCreateAsset).not.toHaveBeenCalled()
  })
  it('cleans up after a library failure and preserves the error', async () => {
    mockCreateAsset.mockRejectedValueOnce(new Error('save failed'))
    await expect(saveQrImageToPhotos('data:image/png;base64,aGVsbG8=', 'top-up')).rejects.toThrow('save failed')
    expect(mockFile.delete).toHaveBeenCalled()
  })
  it('rejects unsupported sources without creating a photo', async () => {
    expect(await saveQrImageToPhotos('file:///private/other.png', 'top-up')).toEqual({ ok: false, reason: 'unsupported' })
    expect(mockCreateAsset).not.toHaveBeenCalled()
  })
})
