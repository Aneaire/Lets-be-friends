import { uploadedStorageId } from '@/features/social/postMediaUploadResult'

export type ChatAttachmentSource = {
  uri: string
  mimeType: string
}

export type PreparedChatUpload = {
  uri: string
  mimeType: string
  fileSize: number
  body: Blob
}

export async function prepareChatUpload(source: ChatAttachmentSource): Promise<PreparedChatUpload> {
  const response = await fetch(source.uri)
  if (!response.ok) throw new Error('The selected file could not be read. Please choose it again.')
  const body = await response.blob()
  return {
    uri: source.uri,
    mimeType: source.mimeType || body.type,
    fileSize: body.size,
    body,
  }
}

export async function uploadChatAttachment(uploadUrl: string, upload: PreparedChatUpload) {
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': upload.mimeType },
    body: upload.body,
  })
  const storageId = uploadedStorageId(response.status, await response.text())
  if (!storageId) throw new Error('A file upload failed. No file was attached to your message.')
  return storageId
}
