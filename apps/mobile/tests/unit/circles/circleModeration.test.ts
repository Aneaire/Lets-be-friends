import {
  canAccessCircleRemovedContent,
  circleImageKindLabel,
  validateCircleImageAsset,
} from '@/features/circles/circlePresentation'

describe('mobile Circle removed-content recovery access', () => {
  it('lets moderators restore in active Circles without host ownership', () => {
    expect(canAccessCircleRemovedContent({ canModerate: true, circleState: 'active' })).toBe(true)
  })

  it('denies members and keeps archived Circles read-only', () => {
    expect(canAccessCircleRemovedContent({ canModerate: false, circleState: 'active' })).toBe(false)
    expect(canAccessCircleRemovedContent({ canModerate: true, circleState: 'archived' })).toBe(false)
    expect(canAccessCircleRemovedContent({ canModerate: true, circleState: 'suspended' })).toBe(false)
    expect(canAccessCircleRemovedContent({})).toBe(false)
  })
})

describe('mobile Circle image validation', () => {
  it('accepts still JPEG, PNG, and WebP images within 5 MB', () => {
    expect(validateCircleImageAsset({ type: 'image', mimeType: 'image/jpeg', fileName: 'icon.jpg', fileSize: 1024 })).toEqual({
      ok: true,
      contentType: 'image/jpeg',
    })
    expect(validateCircleImageAsset({ mimeType: 'image/webp', fileName: 'cover.webp', fileSize: 5 * 1024 * 1024 })).toEqual({
      ok: true,
      contentType: 'image/webp',
    })
  })

  it('rejects videos, unknown types, and oversized images', () => {
    expect(validateCircleImageAsset({ type: 'video', mimeType: 'video/mp4', fileSize: 1024 }).ok).toBe(false)
    expect(validateCircleImageAsset({ mimeType: 'image/gif', fileName: 'icon.gif', fileSize: 1024 }).ok).toBe(false)
    expect(validateCircleImageAsset({ mimeType: 'image/png', fileName: 'icon.png', fileSize: 6 * 1024 * 1024 }).ok).toBe(false)
  })

  it('labels icon and cover distinctly', () => {
    expect(circleImageKindLabel('icon')).toContain('icon')
    expect(circleImageKindLabel('cover')).toContain('cover')
  })
})
