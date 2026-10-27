import { clampImageOffset, clampImageScale, containedImageSize } from '@/features/social/imageViewerGeometry'

describe('full-screen image zoom', () => {
  it('fits portrait and landscape images without occupying the surrounding backdrop', () => {
    expect(containedImageSize({ width: 400, height: 800 }, { width: 400, height: 400 })).toEqual({ width: 200, height: 400 })
    expect(containedImageSize({ width: 800, height: 400 }, { width: 400, height: 400 })).toEqual({ width: 400, height: 200 })
    expect(containedImageSize({ width: 0, height: 400 }, { width: 400, height: 400 })).toEqual({ width: 0, height: 0 })
  })
  it('keeps zoom and panning within the visible image', () => {
    expect(clampImageScale(0.2)).toBe(1)
    expect(clampImageScale(7)).toBe(4)
    expect(clampImageOffset(900, 400, 400, 2)).toBe(200)
    expect(clampImageOffset(-900, 400, 400, 2)).toBe(-200)
    expect(clampImageOffset(100, 200, 400, 1)).toBe(0)
  })
})
