import { resolveMobileWebAppConfiguration } from '@/backend/config'

function webAppUrl() {
  const configuration = resolveMobileWebAppConfiguration()
  return configuration.status === 'configured' ? configuration.url : undefined
}

export function postShareUrl(postId: string) {
  const base = webAppUrl()
  if (!base) return undefined
  return `${base}/social?postId=${encodeURIComponent(postId)}`
}

export function reviewShareUrl(companionProfileId: string, reviewId: string) {
  const base = webAppUrl()
  if (!base) return undefined
  return `${base}/companion-profile?companionProfileId=${encodeURIComponent(companionProfileId)}&reviewId=${encodeURIComponent(reviewId)}`
}
