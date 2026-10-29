/**
 * Web downloads use a blob so a private attachment is saved to the device
 * instead of opening an inline preview.
 */
export async function downloadChatAttachment(url: string, fileName: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('The file could not be downloaded.')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
