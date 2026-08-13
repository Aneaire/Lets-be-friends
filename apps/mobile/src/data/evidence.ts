export type EvidenceDecision = 'uploaded' | 'skipped' | undefined

export const MAX_EVIDENCE_IMAGE_BYTES = 10 * 1024 * 1024
export const supportedEvidenceImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const

export type EvidenceAsset = {
  uri: string
  type?: string | null
  mimeType?: string | null
  fileName?: string | null
  fileSize?: number
}

export function evidenceDecisionCopy(role: 'companion_start' | 'member_end', decision: EvidenceDecision) {
  const label = role === 'companion_start' ? 'Start evidence' : 'End evidence'
  if (decision === 'uploaded') return { label, detail: 'Private image saved for authorized safety review only.' }
  if (decision === 'skipped') return { label, detail: 'Skipped after the strict warning was acknowledged.' }
  return { label, detail: 'Upload one private image or explicitly skip after reading the warning.' }
}

export function validateEvidenceAsset(asset: EvidenceAsset) {
  if (asset.type && asset.type !== 'image') {
    return { ok: false as const, message: 'Choose an image file for private booking evidence.' }
  }
  const contentType = normalizeEvidenceContentType(asset.mimeType, asset.fileName, asset.uri)
  if (!contentType) {
    return { ok: false as const, message: 'Choose a JPEG, PNG, WebP, HEIC, or HEIF image.' }
  }
  if (asset.fileSize !== undefined && (!Number.isSafeInteger(asset.fileSize) || asset.fileSize <= 0 || asset.fileSize > MAX_EVIDENCE_IMAGE_BYTES)) {
    return { ok: false as const, message: 'Private evidence images must be 10 MB or smaller.' }
  }
  return { ok: true as const, contentType }
}

export async function evidenceAssetToArrayBuffer(asset: EvidenceAsset, fetchAsset: typeof fetch = fetch) {
  const validation = validateEvidenceAsset(asset)
  if (!validation.ok) return validation
  try {
    const response = await fetchAsset(asset.uri)
    if (!response.ok) return { ok: false as const, message: 'The selected image could not be read. Choose it again and retry.' }
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_EVIDENCE_IMAGE_BYTES) {
      return { ok: false as const, message: 'Private evidence images must be 10 MB or smaller.' }
    }
    return { ok: true as const, bytes, contentType: validation.contentType }
  } catch {
    return { ok: false as const, message: 'The selected image could not be read. Choose it again and retry.' }
  }
}

function normalizeEvidenceContentType(mimeType?: string | null, fileName?: string | null, uri?: string) {
  const normalized = mimeType?.trim().toLowerCase()
  if (normalized && supportedEvidenceImageTypes.includes(normalized as typeof supportedEvidenceImageTypes[number])) return normalized
  const extension = (fileName || uri || '').split(/[?#]/)[0].split('.').pop()?.toLowerCase()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'heic') return 'image/heic'
  if (extension === 'heif') return 'image/heif'
  return null
}
