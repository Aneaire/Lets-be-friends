import type { Id } from '../../../convex/_generated/dataModel'

export type SelectedMedia = {
  file: File
  kind: 'image' | 'video'
  previewUrl: string
}

export function mediaKind(file: File): 'image' | 'video' | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return null
}

export async function uploadPostMedia(
  media: SelectedMedia[],
  generateUpload: () => Promise<{ uploadUrl: string; uploadId: Id<'postMediaUploads'> }>,
  registerUpload: (args: { uploadId: Id<'postMediaUploads'>; storageId: Id<'_storage'> }) => Promise<unknown>,
  discardUpload: (args: { uploadId: Id<'postMediaUploads'>; storageId?: Id<'_storage'> }) => Promise<unknown>,
): Promise<Id<'postMediaUploads'>[]> {
  const registeredUploadIds: Id<'postMediaUploads'>[] = []
  try {
    for (const item of media) {
      const { uploadUrl, uploadId } = await generateUpload()
      let storageId: Id<'_storage'> | undefined
      try {
        const result = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': item.file.type },
          body: item.file,
        })
        if (!result.ok) throw new Error('Media upload failed.')
        const uploadResult = await result.json() as { storageId: string }
        storageId = uploadResult.storageId as Id<'_storage'>
        await registerUpload({ uploadId, storageId })
        registeredUploadIds.push(uploadId)
      } catch (error) {
        await Promise.allSettled([discardUpload({ uploadId, storageId })])
        throw error
      }
    }
    return registeredUploadIds
  } catch (error) {
    await discardRegisteredUploads(registeredUploadIds, discardUpload)
    throw error
  }
}

export async function discardRegisteredUploads(
  uploadIds: Id<'postMediaUploads'>[],
  discardUpload: (args: { uploadId: Id<'postMediaUploads'>; storageId?: Id<'_storage'> }) => Promise<unknown>,
) {
  await Promise.allSettled(uploadIds.map((uploadId) => discardUpload({ uploadId })))
}
