import {
  avatarCropIsDefault,
  avatarCropPositionFromDrag,
  avatarCropSource,
  avatarPreviewGeometry,
  clampAvatarZoom,
  defaultAvatarCrop,
  normalizeAvatarCrop,
  stepAvatarZoom,
  type AvatarCrop,
} from '@/member/avatarCrop'

describe('avatar crop geometry', () => {
  it('uses a centered square source at the default crop', () => {
    const source = avatarCropSource(1200, 1600, defaultAvatarCrop)
    expect(source.size).toBe(1200)
    expect(source.x).toBe(0)
    expect(source.y).toBe(200)
  })

  it('shrinks the square source as zoom increases', () => {
    const source = avatarCropSource(1200, 1200, { ...defaultAvatarCrop, zoom: 2 })
    expect(source.size).toBe(600)
    expect(source.x).toBe(300)
    expect(source.y).toBe(300)
  })

  it('repositions the crop source within the image bounds', () => {
    const source = avatarCropSource(1200, 1200, { ...defaultAvatarCrop, x: 1, y: -1, zoom: 2 })
    expect(source.size).toBe(600)
    expect(source.x).toBe(0)
    expect(source.y).toBe(600)
  })

  it('clamps zoom outside the supported range', () => {
    expect(clampAvatarZoom(0.2)).toBe(1)
    expect(clampAvatarZoom(9)).toBe(3)
    expect(clampAvatarZoom(1.5)).toBe(1.5)
  })

  it('steps zoom by the configured increment and clamps to bounds', () => {
    expect(stepAvatarZoom(1, 1)).toBe(1.05)
    expect(stepAvatarZoom(1, -1)).toBe(1)
    expect(stepAvatarZoom(3, 1)).toBe(3)
    expect(stepAvatarZoom(2.98, 1)).toBe(3)
  })

  it('normalizes out-of-range position and zoom values', () => {
    expect(normalizeAvatarCrop({ x: 4, y: -7, zoom: 0.2 })).toEqual({ x: 1, y: -1, zoom: 1 })
    expect(normalizeAvatarCrop({ x: 0.4, y: -0.4, zoom: 2 })).toEqual({ x: 0.4, y: -0.4, zoom: 2 })
  })

  it('reports an unmodified crop as the default', () => {
    expect(avatarCropIsDefault(defaultAvatarCrop)).toBe(true)
    expect(avatarCropIsDefault({ x: 0.1, y: 0, zoom: 1 })).toBe(false)
  })
})

describe('avatar preview geometry', () => {
  it('returns an empty frame before image dimensions are known', () => {
    const geometry = avatarPreviewGeometry(0, 0, defaultAvatarCrop, 240)
    expect(geometry).toEqual({ width: 240, height: 240, offsetX: 0, offsetY: 0, maxOffsetX: 0, maxOffsetY: 0 })
  })

  it('centers a landscape image with no offset available at default zoom', () => {
    const geometry = avatarPreviewGeometry(400, 200, defaultAvatarCrop, 240)
    expect(geometry.width).toBe(480)
    expect(geometry.height).toBe(240)
    expect(geometry.maxOffsetX).toBe(120)
    expect(geometry.maxOffsetY).toBe(0)
    expect(geometry.offsetX).toBe(0)
    expect(geometry.offsetY).toBe(0)
  })

  it('offsets the preview when the position is dragged beyond the frame', () => {
    const geometry = avatarPreviewGeometry(400, 200, { ...defaultAvatarCrop, x: 1 }, 240)
    expect(geometry.offsetX).toBe(120)
    expect(geometry.offsetY).toBe(0)
  })

  it('grows the preview and its offset range as zoom increases', () => {
    const geometry = avatarPreviewGeometry(400, 200, { ...defaultAvatarCrop, zoom: 2 }, 240)
    expect(geometry.width).toBe(960)
    expect(geometry.maxOffsetX).toBe(360)
    expect(geometry.maxOffsetY).toBe(120)
  })

  it('translates a drag into a clamped new position using the frame offset range', () => {
    const geometry = avatarPreviewGeometry(400, 200, defaultAvatarCrop, 240)
    const next = avatarCropPositionFromDrag({ x: 0, y: 0, zoom: 1 }, geometry, 240, 0)
    expect(next.x).toBe(1)
    expect(next.y).toBe(0)

    const constrained = avatarPreviewGeometry(400, 200, { ...defaultAvatarCrop, zoom: 2 }, 240)
    const clamped = avatarCropPositionFromDrag({ x: 0, y: 0, zoom: 1 }, constrained, 9999, -9999)
    const crop: AvatarCrop = clamped
    expect(crop.x).toBe(1)
    expect(crop.y).toBe(-1)
  })

  it('keeps the position fixed when the frame offset range is zero', () => {
    const geometry = avatarPreviewGeometry(400, 200, defaultAvatarCrop, 240)
    geometry.maxOffsetX = 0
    geometry.maxOffsetY = 0
    const next = avatarCropPositionFromDrag({ x: 0.5, y: -0.5, zoom: 1 }, geometry, 200, -200)
    expect(next.x).toBe(0)
    expect(next.y).toBe(0)
  })
})
