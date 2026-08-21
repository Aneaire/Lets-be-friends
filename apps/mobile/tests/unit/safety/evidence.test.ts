import {
  MAX_EVIDENCE_IMAGE_BYTES,
  evidenceAssetToArrayBuffer,
  evidenceDecisionCopy,
  validateEvidenceAsset,
} from '@/data/evidence'

describe('booking evidence helpers', () => {
  it('uses truthful role, privacy, and decision copy', () => {
    expect(evidenceDecisionCopy('companion_start', 'uploaded')).toEqual({ label: 'Start evidence', detail: 'Private image saved for authorized safety review only.' })
    expect(evidenceDecisionCopy('member_end', 'skipped')).toEqual({ label: 'End evidence', detail: 'Skipped after the strict warning was acknowledged.' })
    expect(evidenceDecisionCopy('member_end', undefined).detail).toContain('explicitly skip')
  })

  it('accepts backend-supported image types and rejects unsupported or oversized assets', () => {
    expect(validateEvidenceAsset({ uri: 'file:///photo.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: 500 })).toEqual({ ok: true, contentType: 'image/jpeg' })
    expect(validateEvidenceAsset({ uri: 'file:///photo.HEIC', type: 'image' })).toEqual({ ok: true, contentType: 'image/heic' })
    expect(validateEvidenceAsset({ uri: 'file:///photo.gif', type: 'image', mimeType: 'image/gif' })).toMatchObject({ ok: false })
    expect(validateEvidenceAsset({ uri: 'file:///video.mp4', type: 'video', mimeType: 'video/mp4' })).toMatchObject({ ok: false })
    expect(validateEvidenceAsset({ uri: 'file:///large.png', type: 'image', mimeType: 'image/png', fileSize: MAX_EVIDENCE_IMAGE_BYTES + 1 })).toMatchObject({ ok: false })
  })

  it('converts selected assets to bounded ArrayBuffer bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer
    const fetchAsset = jest.fn(async () => ({ ok: true, arrayBuffer: async () => bytes })) as unknown as typeof fetch
    await expect(evidenceAssetToArrayBuffer({ uri: 'file:///photo.webp', type: 'image', mimeType: 'image/webp' }, fetchAsset)).resolves.toEqual({
      ok: true,
      bytes,
      contentType: 'image/webp',
    })
  })

  it('rejects unreadable and oversized converted bytes with product-safe copy', async () => {
    const unreadable = jest.fn(async () => ({ ok: false })) as unknown as typeof fetch
    await expect(evidenceAssetToArrayBuffer({ uri: 'file:///photo.png', type: 'image', mimeType: 'image/png' }, unreadable)).resolves.toMatchObject({ ok: false })

    const oversized = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(MAX_EVIDENCE_IMAGE_BYTES + 1),
    })) as unknown as typeof fetch
    await expect(evidenceAssetToArrayBuffer({ uri: 'file:///large.png', type: 'image', mimeType: 'image/png' }, oversized)).resolves.toMatchObject({ ok: false })
  })
})
