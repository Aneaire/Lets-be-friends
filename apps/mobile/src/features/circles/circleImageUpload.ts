import type { CircleId, StorageId } from '@/backend/client'
import {
  preparePostMedia as defaultPreparePostMedia,
  uploadPostMedia as defaultUploadPostMedia,
} from '@/features/social/postMediaUpload'

import {
  MAX_CIRCLE_IMAGE_BYTES,
  supportedCircleImageTypes,
  validateCircleImageAsset,
} from './circlePresentation'

export type CircleImageKind = 'icon' | 'cover'

export type CircleImageAsset = {
  uri?: string | null
  type?: string | null
  mimeType?: string | null
  fileName?: string | null
  fileSize?: number | null
}

export type CircleImageUploadDeps = {
  generateUploadUrl: (args: { circleId: CircleId; kind: CircleImageKind }) => Promise<string>
  setImage: (args: { circleId: CircleId; kind: CircleImageKind; storageId: StorageId }) => Promise<unknown>
  prepareMedia?: typeof defaultPreparePostMedia
  uploadMedia?: typeof defaultUploadPostMedia
}

export const CIRCLE_IMAGE_TYPE_MESSAGE = 'Circle images must be JPEG, PNG, or WebP still images.'
export const CIRCLE_IMAGE_STILL_MESSAGE = 'Choose a still image for the Circle icon or cover.'
export const CIRCLE_IMAGE_SIZE_MESSAGE = 'Circle images must be 5 MB or smaller.'
export const CIRCLE_IMAGE_READ_MESSAGE = 'The selected image could not be read. Choose it again and retry.'
export const CIRCLE_IMAGE_UPLOAD_MESSAGE = 'Circle image upload failed.'

export function isCircleImageSafeMessage(message: unknown) {
  return (
    message === CIRCLE_IMAGE_TYPE_MESSAGE ||
    message === CIRCLE_IMAGE_STILL_MESSAGE ||
    message === CIRCLE_IMAGE_SIZE_MESSAGE ||
    message === CIRCLE_IMAGE_READ_MESSAGE ||
    message === CIRCLE_IMAGE_UPLOAD_MESSAGE
  )
}

/**
 * Circle icon/cover upload orchestration. Reuses the platform-aware shared
 * post media pipeline (expo-file-system on native, fetch Blob on web) so
 * device file:// assets upload reliably. There is no daily social grant
 * here: the Circle image URL comes from generateCircleImageUploadUrl and the
 * result is applied with setCircleImage.
 *
 * Returns null when the picker was canceled so the caller can unlock and
 * allow a retry without touching the backend.
 */
export async function uploadCircleImage(input: {
  circleId: CircleId
  kind: CircleImageKind
  asset: CircleImageAsset | null | undefined
  deps: CircleImageUploadDeps
}): Promise<StorageId | null> {
  const { circleId, kind, asset, deps } = input
  if (!asset?.uri) return null

  const initial = validateCircleImageAsset({
    type: asset.type,
    mimeType: asset.mimeType,
    fileName: asset.fileName,
    uri: asset.uri,
    fileSize: asset.fileSize ?? undefined,
  })
  if (!initial.ok) throw new Error(initial.message)

  const prepareMedia = deps.prepareMedia ?? defaultPreparePostMedia
  const uploadMedia = deps.uploadMedia ?? defaultUploadPostMedia

  let prepared
  try {
    prepared = await prepareMedia({ uri: asset.uri, mimeType: initial.contentType })
  } catch {
    throw new Error(CIRCLE_IMAGE_READ_MESSAGE)
  }
  if (!prepared) throw new Error(CIRCLE_IMAGE_READ_MESSAGE)

  const actualType = prepared.mimeType?.trim().toLowerCase()
  if (!actualType || !(supportedCircleImageTypes as readonly string[]).includes(actualType)) {
    throw new Error(CIRCLE_IMAGE_TYPE_MESSAGE)
  }
  if (
    !Number.isSafeInteger(prepared.fileSize) ||
    prepared.fileSize <= 0 ||
    prepared.fileSize > MAX_CIRCLE_IMAGE_BYTES
  ) {
    throw new Error(CIRCLE_IMAGE_SIZE_MESSAGE)
  }

  let uploadUrl: string
  try {
    uploadUrl = await deps.generateUploadUrl({ circleId, kind })
  } catch {
    throw new Error(CIRCLE_IMAGE_UPLOAD_MESSAGE)
  }
  if (!uploadUrl || typeof uploadUrl !== 'string') throw new Error(CIRCLE_IMAGE_UPLOAD_MESSAGE)

  let storageId: string
  try {
    storageId = (await uploadMedia(uploadUrl, { ...prepared, mimeType: actualType })) as string
  } catch {
    throw new Error(CIRCLE_IMAGE_UPLOAD_MESSAGE)
  }
  if (!storageId || typeof storageId !== 'string') throw new Error(CIRCLE_IMAGE_UPLOAD_MESSAGE)

  await deps.setImage({ circleId, kind, storageId: storageId as StorageId })
  return storageId as StorageId
}
