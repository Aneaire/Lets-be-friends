// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { avatarCropSource, createCroppedAvatarFile, defaultAvatarCrop } from '../../src/features/profile/avatarCrop'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('avatarCropSource', () => {
  it('uses the centered maximum square at the default zoom', () => {
    expect(avatarCropSource(1200, 800, defaultAvatarCrop)).toEqual({
      x: 200,
      y: 0,
      size: 800,
    })
  })

  it('moves and zooms the crop without exposing space outside the image', () => {
    expect(avatarCropSource(1200, 800, { x: 1, y: -1, zoom: 2 })).toEqual({
      x: 0,
      y: 400,
      size: 400,
    })
  })

  it('clamps position and zoom to the editor limits', () => {
    expect(avatarCropSource(600, 900, { x: 8, y: -8, zoom: 8 })).toEqual({
      x: 0,
      y: 700,
      size: 200,
    })
  })

  it('exports the chosen square as a webp file for upload', async () => {
    const drawImage = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:source'),
      revokeObjectURL: vi.fn(),
    })
    vi.stubGlobal('Image', class {
      naturalWidth = 1200
      naturalHeight = 800
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['cropped'], { type: 'image/webp' }))
    })

    const result = await createCroppedAvatarFile(
      new File(['source'], 'friends.png', { type: 'image/png' }),
      { x: 1, y: 0, zoom: 2 },
    )

    expect(result.name).toBe('friends-avatar.webp')
    expect(result.type).toBe('image/webp')
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 200, 400, 400, 0, 0, 768, 768)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:source')
  })

  it('rejects invalid source files before opening them', async () => {
    await expect(createCroppedAvatarFile(
      new File(['text'], 'notes.txt', { type: 'text/plain' }),
      defaultAvatarCrop,
    )).rejects.toThrow('Profile image must be an image file.')

    await expect(createCroppedAvatarFile(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
      defaultAvatarCrop,
    )).rejects.toThrow('Profile image must be 5 MB or smaller.')
  })
})
