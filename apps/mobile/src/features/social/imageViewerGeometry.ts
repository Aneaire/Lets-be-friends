export type ImageSize = { width: number; height: number }

export function containedImageSize(image: ImageSize, viewport: ImageSize): ImageSize {
  if (image.width <= 0 || image.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return { width: 0, height: 0 }
  const ratio = Math.min(viewport.width / image.width, viewport.height / image.height)
  return { width: image.width * ratio, height: image.height * ratio }
}

export function clampImageScale(scale: number) {
  return Math.max(1, Math.min(4, scale))
}

export function clampImageOffset(offset: number, imageSize: number, viewportSize: number, scale: number) {
  const limit = Math.max(0, (imageSize * scale - viewportSize) / 2)
  return Math.max(-limit, Math.min(limit, offset))
}
