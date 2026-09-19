export type ShareTarget =
  | { kind: 'post'; postId: string }
  | { kind: 'review'; companionProfileId: string; reviewId: string }

export function postSharePath(postId: string) {
  return `/social?postId=${encodeURIComponent(postId)}`
}

export function reviewSharePath(companionProfileId: string, reviewId: string) {
  return `/companion-profile?companionProfileId=${encodeURIComponent(companionProfileId)}&reviewId=${encodeURIComponent(reviewId)}`
}

export function shareTargetUrl(target: ShareTarget, origin?: string) {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  const path = target.kind === 'post'
    ? postSharePath(target.postId)
    : reviewSharePath(target.companionProfileId, target.reviewId)
  return `${base}${path}`
}

export async function copyShareUrl(url: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return true
    }
  } catch {
    // Fall through to the legacy path when the async clipboard is denied.
  }
  try {
    if (typeof document === 'undefined') return false
    const textarea = document.createElement('textarea')
    textarea.value = url
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}
