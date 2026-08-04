export const CHAT_COMPRESSION_THRESHOLD_BYTES = 3 * 1024 * 1024
export const MAX_CHAT_ATTACHMENTS = 4
export const MAX_EVIDENCE_IMAGE_BYTES = 10 * 1024 * 1024

export type ChatAttachmentKind = 'image' | 'video' | 'file'

export type PreparedChatAttachment = {
  file: File
  originalSize: number
  compressionPercent: number
  kind: ChatAttachmentKind
}

export function chatAttachmentKind(contentType: string): ChatAttachmentKind {
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('video/')) return 'video'
  return 'file'
}

export function targetCompressionPercent(size: number) {
  if (size < CHAT_COMPRESSION_THRESHOLD_BYTES) return 0
  const mib = size / 1024 / 1024
  if (mib < 8) return 18
  if (mib < 20) return 32
  if (mib < 50) return 48
  if (mib < 100) return 60
  return 70
}

export function actualCompressionPercent(originalSize: number, compressedSize: number) {
  if (originalSize <= 0 || compressedSize >= originalSize) return 0
  return Math.max(0, Math.min(99, Math.round((1 - compressedSize / originalSize) * 100)))
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  const mib = size / 1024 / 1024
  return `${mib >= 10 ? Math.round(mib) : mib.toFixed(1)} MB`
}

export async function prepareChatAttachment(file: File, onProgress?: (progress: number) => void): Promise<PreparedChatAttachment> {
  const kind = chatAttachmentKind(file.type)
  validateClientFile(file, kind)
  if (kind === 'file' || file.size < CHAT_COMPRESSION_THRESHOLD_BYTES) {
    onProgress?.(100)
    return { file, originalSize: file.size, compressionPercent: 0, kind }
  }
  const compressed = kind === 'image'
    ? await compressImage(file, targetCompressionPercent(file.size), onProgress)
    : await compressVideo(file, targetCompressionPercent(file.size), onProgress)
  if (compressed.size >= file.size) throw new Error(`${kind === 'image' ? 'Image' : 'Video'} could not be reduced. Choose a smaller file.`)
  return {
    file: compressed,
    originalSize: file.size,
    compressionPercent: actualCompressionPercent(file.size, compressed.size),
    kind,
  }
}

export function evidenceImageReductionPercent(size: number) {
  const sizeTarget = size > 8 * 1024 * 1024 ? Math.ceil((1 - (8 * 1024 * 1024) / size) * 100) : 0
  return Math.max(5, targetCompressionPercent(size), sizeTarget)
}

/** Re-encodes every evidence image through canvas so common embedded metadata is not carried into private storage. */
export async function prepareEvidenceImage(file: File, onProgress?: (progress: number) => void) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image for booking evidence.')
  if (file.type === 'image/gif') throw new Error('Animated GIFs are not supported for booking evidence.')
  if (file.size > 80 * 1024 * 1024) throw new Error('Evidence images must be 80 MB or smaller before processing.')
  const processed = await compressImage(file, evidenceImageReductionPercent(file.size), onProgress)
  if (processed.size > MAX_EVIDENCE_IMAGE_BYTES) throw new Error('The processed evidence image is still over 10 MB. Choose a smaller image.')
  return processed
}

function validateClientFile(file: File, kind: ChatAttachmentKind) {
  const allowedDocuments = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ])
  if (kind === 'file' && !allowedDocuments.has(file.type)) throw new Error('Choose an image, video, PDF, text, Word, Excel, or PowerPoint file.')
  if (kind === 'file' && file.size > 20 * 1024 * 1024) throw new Error('Documents must be 20 MB or smaller.')
  if (kind === 'image' && file.size > 80 * 1024 * 1024) throw new Error('Images must be 80 MB or smaller before compression.')
  if (kind === 'video' && file.size > 250 * 1024 * 1024) throw new Error('Videos must be 250 MB or smaller before compression.')
  if (kind === 'image' && file.type === 'image/gif' && file.size >= CHAT_COMPRESSION_THRESHOLD_BYTES) {
    throw new Error('Animated GIFs over 3 MB cannot be compressed. Choose a smaller GIF or a video.')
  }
}

async function compressImage(file: File, reductionPercent: number, onProgress?: (progress: number) => void) {
  onProgress?.(5)
  const bitmap = await createImageBitmap(file)
  try {
    const targetBytes = file.size * (1 - reductionPercent / 100)
    const maxEdge = file.size >= 20 * 1024 * 1024 ? 2_048 : file.size >= 8 * 1024 * 1024 ? 2_560 : 3_200
    let scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    let quality = 0.88
    let best: Blob | null = null

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { alpha: true })
      if (!context) throw new Error('Image compression is not available in this browser.')
      context.drawImage(bitmap, 0, 0, width, height)
      const blob = await canvasToBlob(canvas, 'image/webp', quality)
      if (!best || blob.size < best.size) best = blob
      onProgress?.(15 + Math.round(((attempt + 1) / 7) * 80))
      if (blob.size <= targetBytes) break
      quality = Math.max(0.48, quality - 0.08)
      if (quality <= 0.56) scale *= 0.82
    }
    if (!best) throw new Error('Image compression failed.')
    onProgress?.(100)
    return new File([best], replaceExtension(file.name, 'webp'), { type: 'image/webp', lastModified: file.lastModified })
  } finally {
    bitmap.close()
  }
}

async function compressVideo(file: File, reductionPercent: number, onProgress?: (progress: number) => void) {
  if (typeof MediaRecorder === 'undefined') throw new Error('Video compression is not supported in this browser.')
  const mimeType = supportedVideoMimeType()
  if (!mimeType) throw new Error('Video compression is not supported in this browser.')
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.playsInline = true
  video.muted = true
  const objectUrl = URL.createObjectURL(file)
  video.src = objectUrl
  await waitForEvent(video, 'loadedmetadata')
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    URL.revokeObjectURL(objectUrl)
    throw new Error('Video duration could not be read.')
  }
  if (video.duration > 10 * 60) {
    URL.revokeObjectURL(objectUrl)
    throw new Error('Videos can be up to 10 minutes long.')
  }

  const maxEdge = file.size >= 50 * 1024 * 1024 ? 960 : file.size >= 20 * 1024 * 1024 ? 1_280 : 1_920
  const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2)
  canvas.height = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2)
  const context = canvas.getContext('2d')
  if (!context) {
    URL.revokeObjectURL(objectUrl)
    throw new Error('Video compression is not available in this browser.')
  }

  const targetBytes = file.size * (1 - reductionPercent / 100)
  const targetBitsPerSecond = Math.max(450_000, Math.floor(targetBytes * 8 / video.duration))
  const canvasStream = canvas.captureStream(30)
  const captureStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.()
  captureStream?.getAudioTracks().forEach((track) => canvasStream.addTrack(track))
  const recorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: Math.max(320_000, targetBitsPerSecond - 96_000),
    audioBitsPerSecond: 96_000,
  })
  const chunks: Blob[] = []
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  const finished = new Promise<void>((resolve, reject) => {
    recorder.addEventListener('stop', () => resolve(), { once: true })
    recorder.addEventListener('error', () => reject(new Error('Video compression failed.')), { once: true })
  })
  let animationFrame = 0
  const draw = () => {
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    onProgress?.(Math.min(99, Math.max(1, Math.round(video.currentTime / video.duration * 100))))
    if (!video.ended) animationFrame = requestAnimationFrame(draw)
  }

  try {
    recorder.start(1_000)
    await video.play()
    draw()
    await waitForEvent(video, 'ended')
    recorder.stop()
    await finished
    onProgress?.(100)
    const outputType = mimeType.split(';')[0]
    return new File([new Blob(chunks, { type: outputType })], replaceExtension(file.name, 'webm'), {
      type: outputType,
      lastModified: file.lastModified,
    })
  } finally {
    cancelAnimationFrame(animationFrame)
    video.pause()
    canvasStream.getTracks().forEach((track) => track.stop())
    captureStream?.getTracks().forEach((track) => track.stop())
    URL.revokeObjectURL(objectUrl)
  }
}

function supportedVideoMimeType() {
  const options = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return options.find((type) => MediaRecorder.isTypeSupported(type))
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image compression failed.')), type, quality)
  })
}

function waitForEvent(target: EventTarget, eventName: string) {
  return new Promise<void>((resolve, reject) => {
    target.addEventListener(eventName, () => resolve(), { once: true })
    target.addEventListener('error', () => reject(new Error(`Could not read ${eventName === 'ended' ? 'video' : 'file'}.`)), { once: true })
  })
}

function replaceExtension(fileName: string, extension: string) {
  const base = fileName.replace(/\.[^.]+$/, '') || 'attachment'
  return `${base}.${extension}`
}
