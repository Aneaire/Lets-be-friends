import { uploadedStorageId } from './postMediaUploadResult'

export type PostMediaSource = {
  uri: string
  mimeType?: string | null
}

export type PreparedPostMedia = {
  uri: string
  mimeType: string
  fileSize: number
  body?: Blob
}

export async function preparePostMedia(source: PostMediaSource): Promise<PreparedPostMedia> {
  const response = await fetch(source.uri)
  if (!response.ok) throw new Error('The selected media could not be read.')
  const body = await response.blob()
  return { uri: source.uri, mimeType: source.mimeType || body.type, fileSize: body.size, body }
}

export async function uploadPostMedia(uploadUrl: string, media: PreparedPostMedia) {
  if (!media.body) throw new Error('The selected media could not be read.')
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': media.mimeType },
    body: media.body,
  })
  const storageId = uploadedStorageId(response.status, await response.text())
  if (!storageId) throw new Error('A media upload failed. No media was attached to your post.')
  return storageId
}
